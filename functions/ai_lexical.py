"""
src/ai_lexical.py — Fast-path lexical de catégorisation.

Port Python du moteur public/src/services/aiEngine.ts (déjà utilisé côté front
par useAutoCategorization). Même algorithme, mêmes poids, mêmes seuils :
construit un modèle pondéré à partir des transactions catégorisées (par mot,
par préfixe 2 mots, par libellé exact — avec un poids contextuel signe+compte
et un poids de récence), puis suggère une catégorie + confiance (0–99).

Sert de fast-path dans le pipeline d'import : si la suggestion lexicale est
très confiante, on assigne sans appel LLM (économie de coût + latence). Le
RAG/LLM reste utile uniquement sur les cas ambigus.

Pas d'I/O ici — pur, testable unitairement.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ai_rag import normalize_label, tokenize_label

DAY_S = 86_400


def _recency_score(date_value, now_ts: float) -> float:
    """Même barème que aiEngine.scoreByRecency : favorise les habitudes récentes."""
    if not date_value:
        return 1.0
    try:
        if isinstance(date_value, datetime):
            ts = date_value.timestamp()
        else:
            ts = datetime.strptime(str(date_value)[:10], "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            ).timestamp()
    except (ValueError, TypeError):
        return 1.0
    age_days = max(0.0, (now_ts - ts) / DAY_S)
    if age_days <= 90:
        return 2.0
    if age_days <= 365:
        return 1.5
    if age_days <= 730:
        return 1.2
    return 1.0


def _amount_direction(montant) -> str:
    try:
        return "pos" if float(montant) >= 0 else "neg"
    except (TypeError, ValueError):
        return "neg"


def build_category_model(
    transactions: list[dict],
    now_ts: float | None = None,
) -> dict:
    """Construit le modèle pondéré à partir des transactions catégorisées.

    Retourne un dict {wordCats, labelCats, prefixCats, meta} — même structure
    que aiEngine.buildCategoryModel pour rester fidèle au front.
    """
    word_cats: dict[str, dict[str, float]] = {}
    label_cats: dict[str, dict[str, float]] = {}
    prefix_cats: dict[str, dict[str, float]] = {}
    meta = {"total": 0}
    nts = now_ts if now_ts is not None else datetime.now(tz=timezone.utc).timestamp()

    for tx in transactions:
        cat = str(tx.get("categorie") or "").strip()
        if not cat or cat == "A Catégoriser":
            continue
        label = normalize_label(tx.get("libelle"))
        if len(label) < 3:
            continue

        recency = _recency_score(tx.get("date"), nts)
        amount_dir = _amount_direction(tx.get("montant"))
        account_key = str(tx.get("compte") or "").strip().lower()
        context_w = 1.15 if account_key else 1.0
        global_score = recency * context_w
        meta["total"] += 1

        label_cats.setdefault(label, {})
        label_cats[label][cat] = label_cats[label].get(cat, 0.0) + global_score

        ctx_label_key = f"{label}||{amount_dir}||{account_key}"
        label_cats.setdefault(ctx_label_key, {})
        label_cats[ctx_label_key][cat] = (
            label_cats[ctx_label_key].get(cat, 0.0) + global_score * 1.1
        )

        words = tokenize_label(label)
        if not words:
            continue

        if len(words) >= 2:
            prefix = f"{words[0]} {words[1]}"
            prefix_cats.setdefault(prefix, {})
            prefix_cats[prefix][cat] = (
                prefix_cats[prefix].get(cat, 0.0) + global_score * 1.2
            )

        for word in words:
            word_cats.setdefault(word, {})
            word_cats[word][cat] = word_cats[word].get(cat, 0.0) + global_score
            ctx_word_key = f"{word}||{amount_dir}||{account_key}"
            word_cats.setdefault(ctx_word_key, {})
            word_cats[ctx_word_key][cat] = (
                word_cats[ctx_word_key].get(cat, 0.0) + global_score * 0.7
            )

    return {"wordCats": word_cats, "labelCats": label_cats,
            "prefixCats": prefix_cats, "meta": meta}


def _best(scores: dict[str, float]) -> tuple[str, float] | None:
    if not scores:
        return None
    items = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    return items[0]


def suggest_category_lexical(tx: dict, model: dict) -> dict | None:
    """Suggère (cat, confidence ∈ [0,99], method ∈ {'exact','prefix','words'}).

    Retourne None si aucun signal exploitable (libellé trop court ou aucun mot
    indexé). Algorithme aligné sur aiEngine.suggestCategory.
    """
    label = normalize_label(tx.get("libelle"))
    if len(label) < 3:
        return None

    words = tokenize_label(label)
    amount_dir = _amount_direction(tx.get("montant"))
    account_key = str(tx.get("compte") or "").strip().lower()
    ctx_label_key = f"{label}||{amount_dir}||{account_key}"

    label_cats = model.get("labelCats", {})
    prefix_cats = model.get("prefixCats", {})
    word_cats = model.get("wordCats", {})

    exact = label_cats.get(ctx_label_key) or label_cats.get(label)
    if exact:
        best = _best(exact)
        if best:
            cat, score = best
            if score >= 2:
                return {"cat": cat, "confidence": min(99, 72 + score * 4), "method": "exact"}
            return {"cat": cat, "confidence": 62, "method": "exact"}

    if len(words) >= 2:
        prefix = f"{words[0]} {words[1]}"
        if prefix in prefix_cats:
            best = _best(prefix_cats[prefix])
            if best and best[1] >= 2:
                return {"cat": best[0], "confidence": min(95, 64 + best[1] * 3), "method": "prefix"}

    cat_scores: dict[str, float] = {}
    for word in words:
        for c, s in word_cats.get(word, {}).items():
            cat_scores[c] = cat_scores.get(c, 0.0) + s
        ctx_word_key = f"{word}||{amount_dir}||{account_key}"
        for c, s in word_cats.get(ctx_word_key, {}).items():
            cat_scores[c] = cat_scores.get(c, 0.0) + s

    if not cat_scores:
        return None

    sorted_cats = sorted(cat_scores.items(), key=lambda kv: kv[1], reverse=True)
    best_cat, best_score = sorted_cats[0]
    total = sum(s for _, s in sorted_cats)
    confidence = min(95, round((best_score / total) * 100))
    if confidence < 33:
        return None
    return {"cat": best_cat, "confidence": confidence, "method": "words"}
