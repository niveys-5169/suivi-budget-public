"""
src/ai_rag.py — Cœur (pur) de la catégorisation RAG côté backend.

RAG = Retrieval-Augmented Generation :
  1. Retrieval  : retrouve dans l'historique les transactions étiquetées les plus
                  proches de la transaction à classer (similarité lexicale).
  2. Augmented  : construit un prompt contraignant le modèle à répondre
                  EXACTEMENT une catégorie issue du vocabulaire de l'utilisateur
                  (= celles présentes dans les exemples retrouvés).
  3. Generation : appelée par ai_categorizer.py (couche I/O, hors de ce module).

Pas d'I/O ici — toutes les fonctions sont pures et testables unitairement.
Le port respecte la même sémantique que public/src/services/aiRag.ts (qui a été
retiré du frontend) : un changement d'algo doit toucher les deux côtés.
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

DAY_S = 86_400
UNCATEGORIZED = {"", "a categoriser", "non categorise"}
SENTINEL = "INCONNU"
_NON_ALNUM = re.compile(r"[^0-9A-Za-z]+", re.UNICODE)
_WS = re.compile(r"\s+")


def normalize_label(value) -> str:
    """Minuscule, sans accents, sans ponctuation, espaces réduits."""
    if value is None:
        return ""
    s = str(value)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = _NON_ALNUM.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    return s


def tokenize_label(normalized: str) -> list[str]:
    """Tokens utiles : longueur > 2, non entièrement numériques."""
    return [t for t in normalized.split(" ") if len(t) > 2 and not t.isdigit()]


def _now_ts() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


def _recency_weight(date_value, now_ts: float) -> float:
    """Une habitude récente prime sur une vieille transaction (mêmes seuils que aiRag.ts)."""
    if not date_value:
        return 1.0
    try:
        if isinstance(date_value, datetime):
            ts = date_value.timestamp()
        else:
            s = str(date_value)[:10]
            ts = datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
    except (ValueError, TypeError):
        return 1.0
    age_days = max(0.0, (now_ts - ts) / DAY_S)
    if age_days <= 90:
        return 1.5
    if age_days <= 365:
        return 1.25
    if age_days <= 730:
        return 1.1
    return 1.0


def _amount_sign(montant) -> str:
    try:
        return "pos" if float(montant) >= 0 else "neg"
    except (TypeError, ValueError):
        return "neg"


def retrieve_similar_examples(
    target: dict,
    history: list[dict],
    k: int = 5,
    now_ts: float | None = None,
) -> list[dict]:
    """Retourne les `k` exemples historiques les plus proches de `target`.

    Score = recouvrement de tokens (+ bonus libellé exact / même signe / même
    compte), pondéré par la récence. Les transactions non catégorisées, la
    cible elle-même et les doublons (libellé+catégorie) sont écartés.

    Chaque exemple retourné : {libelle, categorie, montant, score}.
    """
    target_label = normalize_label(target.get("libelle"))
    if not target_label:
        return []
    target_tokens = set(tokenize_label(target_label))
    target_sign = _amount_sign(target.get("montant"))
    target_compte = str(target.get("compte") or "").strip().lower()
    nts = _now_ts() if now_ts is None else now_ts

    scored: list[dict] = []
    for tx in history:
        if target.get("id") and tx.get("id") and tx["id"] == target["id"]:
            continue
        categorie = str(tx.get("categorie") or "").strip()
        if normalize_label(categorie) in UNCATEGORIZED:
            continue
        label = normalize_label(tx.get("libelle"))
        if not label:
            continue

        if label == target_label:
            score = 6.0
        elif target_tokens:
            overlap = sum(1 for t in tokenize_label(label) if t in target_tokens)
            if overlap == 0:
                continue
            score = overlap * 2.0
        else:
            continue

        if _amount_sign(tx.get("montant")) == target_sign:
            score += 0.5
        if target_compte and str(tx.get("compte") or "").strip().lower() == target_compte:
            score += 0.5
        score *= _recency_weight(tx.get("date"), nts)

        try:
            montant_val = float(tx.get("montant") or 0)
        except (TypeError, ValueError):
            montant_val = 0.0

        scored.append({
            "libelle": str(tx.get("libelle") or "").strip(),
            "categorie": categorie,
            "montant": montant_val,
            "score": score,
        })

    scored.sort(key=lambda e: e["score"], reverse=True)
    seen: set[str] = set()
    unique: list[dict] = []
    for ex in scored:
        key = f"{normalize_label(ex['libelle'])}::{ex['categorie']}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(ex)
        if len(unique) >= k:
            break
    return unique


def allowed_categories(examples: list[dict]) -> list[str]:
    """Catégories distinctes des exemples — vocabulaire autorisé pour le LLM."""
    return sorted({e["categorie"] for e in examples}, key=lambda s: s.lower())


def build_categorization_prompt(target: dict, examples: list[dict]) -> tuple[str, str, list[str]]:
    """Construit (system, user, allowed). Le LLM doit répondre une catégorie
    de `allowed`, sinon `INCONNU`."""
    allowed = allowed_categories(examples)
    system = (
        "Tu es un assistant de catégorisation de transactions bancaires. "
        "On te donne des transactions passées déjà classées par l'utilisateur, puis une "
        "nouvelle transaction. Réponds par UNE SEULE catégorie, choisie EXACTEMENT dans la "
        f'liste fournie, sans rien ajouter. Si aucune ne convient, réponds "{SENTINEL}".'
    )
    lines = []
    for e in examples:
        signe = "+" if e["montant"] >= 0 else ""
        lines.append(f'- "{e["libelle"]}" ({signe}{e["montant"]}) → {e["categorie"]}')
    try:
        target_montant = float(target.get("montant") or 0)
    except (TypeError, ValueError):
        target_montant = 0.0
    target_sign = "+" if target_montant >= 0 else ""
    user = (
        f"Catégories autorisées : {', '.join(allowed)}\n\n"
        f"Transactions passées :\n" + "\n".join(lines) + "\n\n"
        f'Nouvelle transaction : "{str(target.get("libelle") or "").strip()}" '
        f"({target_sign}{target_montant})\n"
        f"Catégorie :"
    )
    return system, user, allowed


_TRIM_LEAD = re.compile(r"^[-•*\s\"'`]+")
_TRIM_TAIL = re.compile(r"[\"'`.;,\s]+$")


def parse_category_answer(raw: str, allowed: list[str]) -> str | None:
    """Valide la réponse du LLM contre `allowed`. Tolère guillemets, tirets,
    ponctuation finale et casse/accents. Retourne la catégorie canonique ou None.
    """
    if not raw:
        return None
    cleaned = raw.strip().split("\n", 1)[0]
    cleaned = _TRIM_LEAD.sub("", cleaned)
    cleaned = _TRIM_TAIL.sub("", cleaned).strip()
    if not cleaned:
        return None
    norm = normalize_label(cleaned)
    if not norm or norm == normalize_label(SENTINEL):
        return None
    for c in allowed:
        if normalize_label(c) == norm:
            return c
    return None


def confidence_from_examples(chosen: str, examples: list[dict]) -> int:
    """Confiance (0–95) déduite de l'accord des exemples, pondérée par le score."""
    if not examples:
        return 0
    total = sum(e["score"] for e in examples)
    if total <= 0:
        return 0
    match = sum(e["score"] for e in examples if e["categorie"] == chosen)
    return min(95, round((match / total) * 100))
