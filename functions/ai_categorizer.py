"""
src/ai_categorizer.py — Orchestrateur RAG côté backend.

Branchement : ai_rag (retrieval + prompt, pur) → LLM HTTP OpenAI-compatible
(OpenAI / OpenRouter / NVIDIA Build) → parse_category_answer (pur).

Configuration via variables d'environnement :
  AI_API_KEY    : clé API (obligatoire pour activer la catégorisation)
  AI_BASE_URL   : URL de base OpenAI-compatible (défaut: https://api.openai.com/v1)
                  Ex : https://openrouter.ai/api/v1
                       https://integrate.api.nvidia.com/v1
  AI_MODEL      : identifiant de modèle (défaut: gpt-4o-mini)
  AI_PROVIDER   : "openai" (défaut) | "openrouter" | "nvidia"
                  Sert uniquement à ajouter les en-têtes spécifiques OpenRouter.

Si AI_API_KEY est absente, `suggest_category` retourne None sans aucun appel
réseau — les importers continuent sans catégorisation IA, sans erreur.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import requests

from ai_lexical import build_category_model, suggest_category_lexical
from ai_rag import (
    build_categorization_prompt,
    confidence_from_examples,
    normalize_label,
    parse_category_answer,
    retrieve_similar_examples,
)

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_TIMEOUT_S = 20


class AIConfig:
    """Snapshot de la configuration IA (lu une fois, partagé entre les lots)."""

    __slots__ = ("api_key", "base_url", "model", "provider", "extra_headers")

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_MODEL,
        provider: str = "openai",
        extra_headers: dict | None = None,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.provider = provider
        self.extra_headers = extra_headers or {}

    @classmethod
    def from_env(cls) -> Optional["AIConfig"]:
        """Construit la config depuis l'environnement. Retourne None si pas de clé."""
        key = os.environ.get("AI_API_KEY", "").strip()
        if not key:
            return None
        provider = os.environ.get("AI_PROVIDER", "openai").strip().lower() or "openai"
        base_url = os.environ.get("AI_BASE_URL", "").strip() or DEFAULT_BASE_URL
        model = os.environ.get("AI_MODEL", "").strip() or DEFAULT_MODEL
        extra: dict[str, str] = {}
        if provider == "openrouter":
            # OpenRouter exige X-Title et HTTP-Referer pour identifier l'app
            extra["X-Title"] = os.environ.get("AI_APP_NAME", "Suivi Budget")
            extra["HTTP-Referer"] = os.environ.get(
                "AI_APP_URL", "https://github.com/niveys-5169/Suivi-Budget"
            )
        return cls(api_key=key, base_url=base_url, model=model, provider=provider, extra_headers=extra)


def call_openai_compatible(
    config: AIConfig,
    system: str,
    user: str,
    *,
    timeout_s: int = DEFAULT_TIMEOUT_S,
) -> str:
    """Appelle un endpoint OpenAI-compatible /chat/completions.

    Lève RuntimeError sur réponse non-2xx ou contenu vide. L'appelant décide
    comment interpréter l'échec (log warning + skip, vs. abort de l'import).
    """
    url = f"{config.base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {config.api_key}",
        **config.extra_headers,
    }
    body = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        # Une seule catégorie attendue → max_tokens court suffit et borne les coûts.
        "max_tokens": 32,
        "temperature": 0,
    }
    resp = requests.post(url, headers=headers, json=body, timeout=timeout_s)
    if not resp.ok:
        raise RuntimeError(f"LLM HTTP {resp.status_code}: {resp.text[:200]}")
    data = resp.json()
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"LLM réponse inattendue : {e}") from e
    if not text:
        raise RuntimeError("LLM réponse vide")
    return text


def suggest_category(
    target: dict,
    history: list[dict],
    *,
    config: AIConfig | None = None,
    k: int = 5,
    min_confidence: int = 60,
) -> Optional[dict]:
    """Suggère une catégorie pour `target` par RAG.

    Retourne {"categorie", "confidence", "examples"} ou None (sans appel réseau)
    si : pas de config, aucun exemple pertinent, ou confidence sous le seuil.

    L'appelant doit avoir filtré en amont les transactions à ignorer
    (déjà catégorisée, récurrente). Cette fonction ne fait que le RAG.
    """
    cfg = config if config is not None else AIConfig.from_env()
    if cfg is None:
        return None

    examples = retrieve_similar_examples(target, history, k=k)
    if not examples:
        return None

    system, user, allowed = build_categorization_prompt(target, examples)
    try:
        raw = call_openai_compatible(cfg, system, user)
    except RuntimeError as e:
        log.warning("Catégorisation IA échouée pour '%s': %s", target.get("libelle"), e)
        return None

    categorie = parse_category_answer(raw, allowed)
    if not categorie:
        return None

    confidence = confidence_from_examples(categorie, examples)
    if confidence < min_confidence:
        return None

    return {"categorie": categorie, "confidence": confidence, "examples": examples}


# ── Filtre récurrences ──────────────────────────────────────────────────────

RECURRENCE_AMOUNT_TOL = 0.25  # ±25% sur le montant, en valeur absolue
_NON_EMPTY = lambda s: bool(s and s.strip())  # noqa: E731


def is_likely_recurrence(tx: dict, recurrences: list[dict]) -> bool:
    """True si `tx` ressemble à une récurrence active connue.

    Au moment de l'import, la catégorie de `tx` est encore vide — on ne peut
    pas utiliser le match (catégorie + montant + jour) du frontend. On utilise
    donc (label substring + montant ±25%) : la récurrence finira par lui
    assigner sa propre catégorie via computeRecurrenceMappings côté UI, donc
    on évite ici de dépenser une requête LLM pour la même information.

    `recurrences` : itérable de dicts {label, expectedAmount, active}.
    """
    tx_label = normalize_label(tx.get("libelle"))
    if not tx_label:
        return False
    try:
        tx_amount = abs(float(tx.get("montant") or 0))
    except (TypeError, ValueError):
        return False

    for rec in recurrences:
        if rec.get("active") is False:
            continue
        rec_label = normalize_label(rec.get("label"))
        if not rec_label:
            continue

        if rec_label in tx_label or tx_label in rec_label:
            try:
                rec_amount = abs(float(rec.get("expectedAmount") or 0))
            except (TypeError, ValueError):
                continue
            if rec_amount == 0:
                if tx_amount == 0:
                    return True
                continue
            if abs(tx_amount - rec_amount) / rec_amount <= RECURRENCE_AMOUNT_TOL:
                return True

    return False


# ── Pipeline pour les importers ─────────────────────────────────────────────

LEXICAL_FAST_PATH_MIN = 85


def categorize_batch(
    txs_to_import: list[dict],
    history: list[dict],
    recurrences: list[dict] | None = None,
    *,
    config: AIConfig | None = None,
    min_confidence: int = 60,
    lexical_fast_path_min: int = LEXICAL_FAST_PATH_MIN,
) -> dict:
    """Catégorise sur place les transactions d'un batch d'import.

    Pipeline en deux passes :
      1. **Fast-path lexical** (gratuit, hors-ligne) — construit un modèle de
         fréquences pondérées à partir de `history` (transactions déjà
         catégorisées) ; si la suggestion atteint `lexical_fast_path_min`,
         on assigne SANS appel LLM. C'est le tour d'apprentissage sur les
         transactions catégorisées : récurrences silencieuses (libellés
         identiques à du déjà-vu) court-circuitées sans coût.
      2. **RAG (LLM)** — uniquement sur les transactions restantes ambiguës.

    Une transaction n'est traitée que si :
      - sa catégorie est vide (un mapping source la remplit sinon),
      - elle ne ressemble pas à une récurrence active connue (la récurrence
        finira par l'étiqueter via le mapping UI).

    Court-circuit complet (zéro appel réseau) si AI_API_KEY est absente : le
    fast-path lexical tourne quand même et peut catégoriser sans clé IA.

    Retourne {"lexical": n, "rag": n, "total": n, "eligible": n}.
    """
    if not txs_to_import:
        return {"lexical": 0, "rag": 0, "total": 0, "eligible": 0}

    eligible = [
        tx for tx in txs_to_import
        if not _NON_EMPTY(str(tx.get("categorie") or ""))
        and not is_likely_recurrence(tx, recurrences or [])
    ]
    if not eligible:
        return {"lexical": 0, "rag": 0, "total": 0, "eligible": 0}

    # 1) Fast-path lexical sur l'historique catégorisé.
    model = build_category_model(history)
    pending: list[dict] = []
    lexical_hits = 0
    for tx in eligible:
        suggestion = suggest_category_lexical(tx, model)
        if suggestion and suggestion["confidence"] >= lexical_fast_path_min:
            tx["categorie"] = suggestion["cat"]
            tx["ai_categorized"] = True
            tx["ai_confidence"] = suggestion["confidence"]
            tx["ai_method"] = "lexical"
            lexical_hits += 1
        else:
            pending.append(tx)

    # 2) RAG (LLM) sur les transactions restantes — exige une config IA.
    cfg = config if config is not None else AIConfig.from_env()
    rag_hits = 0
    if cfg is not None and pending:
        for tx in pending:
            suggestion = suggest_category(tx, history, config=cfg, min_confidence=min_confidence)
            if suggestion is None:
                continue
            tx["categorie"] = suggestion["categorie"]
            tx["ai_categorized"] = True
            tx["ai_confidence"] = suggestion["confidence"]
            tx["ai_method"] = "rag"
            rag_hits += 1

    total = lexical_hits + rag_hits
    if total:
        log.info(
            "Catégorisation : %d lexical + %d RAG / %d éligibles",
            lexical_hits, rag_hits, len(eligible),
        )
    return {"lexical": lexical_hits, "rag": rag_hits, "total": total, "eligible": len(eligible)}
