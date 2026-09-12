#!/usr/bin/env python3
"""Job backend de catégorisation automatique Firestore.

Ce script est pensé pour GitHub Actions et remplace les opérations lourdes
lancées auparavant depuis le navigateur (applyRulesToUnpointed + aiCategorizeAll).

Séquence :
1) Charge les règles d'auto-catégorisation actives
2) Applique les règles aux transactions non pointées et non catégorisées
3) Construit un modèle IA local (heuristique) depuis l'historique catégorisé
4) Applique les suggestions IA fiables aux transactions restantes
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

UNCATEGORIZED_VALUES = {"", "A Catégoriser"}
BATCH_SIZE = 450


@dataclass
class CategorySuggestion:
    cat: str
    confidence: int
    method: str


def setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def get_db() -> firestore.Client:
    cred_json = os.environ.get("FIREBASE_CREDENTIALS")
    if not cred_json:
        raise RuntimeError("FIREBASE_CREDENTIALS manquant.")

    cred_dict = json.loads(cred_json)
    cred = credentials.Certificate(cred_dict)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return firestore.client()


def normalize_label(value: str | None) -> str:
    text = (value or "").lower().strip()
    text = "".join(ch for ch in text if not ("\u0300" <= ch <= "\u036f"))
    # Décompose les accents avant suppression
    import unicodedata

    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize_label(normalized_label: str) -> list[str]:
    return [
        token
        for token in normalized_label.split(" ")
        if token and len(token) > 2 and not token.isdigit()
    ]


def score_by_recency(date_str: str | None, now_ts: float) -> float:
    if not date_str:
        return 1.0
    try:
        ts = datetime.fromisoformat(f"{date_str}T00:00:00+00:00").timestamp()
    except ValueError:
        return 1.0

    age_days = max(0.0, (now_ts - ts) / (24 * 60 * 60))
    if age_days <= 90:
        return 2.0
    if age_days <= 365:
        return 1.5
    if age_days <= 730:
        return 1.2
    return 1.0


def build_category_model(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    word_cats: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    label_cats: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    prefix_cats: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))

    now_ts = datetime.now(timezone.utc).timestamp()

    for tx in transactions:
        cat = str(tx.get("categorie") or "").strip()
        if cat in UNCATEGORIZED_VALUES:
            continue

        label = normalize_label(tx.get("libelle"))
        if len(label) < 3:
            continue

        recency_weight = score_by_recency(str(tx.get("date") or ""), now_ts)
        amount_direction = "pos" if float(tx.get("montant") or 0) >= 0 else "neg"
        account_key = str(tx.get("compte") or "").strip().lower()
        context_weight = 1.15 if account_key else 1.0
        global_score = recency_weight * context_weight

        label_cats[label][cat] += global_score

        contextual_label_key = f"{label}||{amount_direction}||{account_key}"
        label_cats[contextual_label_key][cat] += global_score * 1.1

        words = tokenize_label(label)
        if len(words) >= 2:
            prefix = f"{words[0]} {words[1]}"
            prefix_cats[prefix][cat] += global_score * 1.2

        for word in words:
            word_cats[word][cat] += global_score
            contextual_word_key = f"{word}||{amount_direction}||{account_key}"
            word_cats[contextual_word_key][cat] += global_score * 0.7

    return {
        "wordCats": word_cats,
        "labelCats": label_cats,
        "prefixCats": prefix_cats,
    }


def suggest_category(tx: dict[str, Any], model: dict[str, Any]) -> CategorySuggestion | None:
    label = normalize_label(tx.get("libelle"))
    if len(label) < 3:
        return None

    words = tokenize_label(label)
    amount_direction = "pos" if float(tx.get("montant") or 0) >= 0 else "neg"
    account_key = str(tx.get("compte") or "").strip().lower()
    contextual_label_key = f"{label}||{amount_direction}||{account_key}"

    label_cats = model["labelCats"]
    exact_cats = label_cats.get(contextual_label_key) or label_cats.get(label)
    if exact_cats:
        best_cat, best_score = max(exact_cats.items(), key=lambda item: item[1])
        if best_score >= 2:
            return CategorySuggestion(
                cat=best_cat,
                confidence=min(99, int(72 + best_score * 4)),
                method="exact",
            )
        return CategorySuggestion(cat=best_cat, confidence=62, method="exact")

    if len(words) >= 2:
        prefix = f"{words[0]} {words[1]}"
        prefix_scores = model["prefixCats"].get(prefix)
        if prefix_scores:
            best_cat, best_score = max(prefix_scores.items(), key=lambda item: item[1])
            if best_score >= 2:
                return CategorySuggestion(
                    cat=best_cat,
                    confidence=min(95, int(64 + best_score * 3)),
                    method="prefix",
                )

    cat_scores: dict[str, float] = defaultdict(float)
    for word in words:
        for cat, score in model["wordCats"].get(word, {}).items():
            cat_scores[cat] += score

        contextual_key = f"{word}||{amount_direction}||{account_key}"
        for cat, score in model["wordCats"].get(contextual_key, {}).items():
            cat_scores[cat] += score

    if not cat_scores:
        return None

    best_cat, best_score = max(cat_scores.items(), key=lambda item: item[1])
    total = sum(cat_scores.values())
    confidence = min(95, round((best_score / total) * 100))
    if confidence < 33:
        return None

    return CategorySuggestion(cat=best_cat, confidence=confidence, method="words")


def load_rules(db: firestore.Client) -> list[dict[str, Any]]:
    rules = []
    snap = db.collection("auto_categorization_rules").stream()
    for doc in snap:
        rule = doc.to_dict() or {}
        rule["id"] = doc.id
        rules.append(rule)

    rules = [r for r in rules if r.get("enabled") is not False]
    rules.sort(key=lambda r: r.get("priority", 10))
    return rules


def matches_rule(rule: dict[str, Any], tx: dict[str, Any]) -> bool:
    if rule.get("enabled") is False:
        return False

    compte_rule = str(rule.get("compte") or "").strip()
    if compte_rule and str(tx.get("compte") or "") != compte_rule:
        return False

    libelle = str(tx.get("libelle") or "")
    libelle_lower = libelle.lower()
    pattern = str(rule.get("pattern") or "")
    pattern_lower = pattern.lower()
    if not pattern_lower:
        return False

    match_type = str(rule.get("matchType") or "contains")
    if match_type == "exact":
        return libelle_lower == pattern_lower
    if match_type == "startsWith":
        return libelle_lower.startswith(pattern_lower)
    if match_type == "regex":
        try:
            return bool(re.search(pattern, libelle, flags=re.IGNORECASE))
        except re.error:
            return False
    return pattern_lower in libelle_lower


def is_uncategorized(tx: dict[str, Any]) -> bool:
    return str(tx.get("categorie") or "").strip() in UNCATEGORIZED_VALUES


def load_transactions(db: firestore.Client) -> list[dict[str, Any]]:
    fields = ["libelle", "categorie", "montant", "date", "compte", "pointe"]
    query = db.collection("transactions").select(fields)
    txs: list[dict[str, Any]] = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        txs.append(data)
    return txs


def commit_updates(
    db: firestore.Client,
    updates: list[tuple[str, dict[str, Any]]],
    dry_run: bool,
) -> int:
    if dry_run or not updates:
        return len(updates)

    count = 0
    batch = db.batch()
    for tx_id, payload in updates:
        ref = db.collection("transactions").document(tx_id)
        batch.update(ref, payload)
        count += 1
        if count % BATCH_SIZE == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    return count


def run(dry_run: bool = False, max_updates: int | None = None) -> dict[str, Any]:
    db = get_db()
    txs = load_transactions(db)
    rules = load_rules(db)

    rule_targets = [tx for tx in txs if not tx.get("pointe") and is_uncategorized(tx)]

    rule_updates: list[tuple[str, dict[str, Any]]] = []
    for tx in rule_targets:
        cat = None
        for rule in rules:
            if matches_rule(rule, tx):
                cat = str(rule.get("categorie") or "").strip()
                break
        if not cat:
            continue
        rule_updates.append((tx["id"], {"categorie": cat, "ruleApplied": True}))
        tx["categorie"] = cat
        tx["ruleApplied"] = True

        if max_updates and len(rule_updates) >= max_updates:
            break

    applied_rules = commit_updates(db, rule_updates, dry_run=dry_run)

    model = build_category_model(txs)

    ai_targets = [tx for tx in txs if not tx.get("pointe") and is_uncategorized(tx)]
    ai_updates: list[tuple[str, dict[str, Any]]] = []
    ai_skipped_low_conf = 0

    for tx in ai_targets:
        suggestion = suggest_category(tx, model)
        if not suggestion or suggestion.confidence < 50:
            ai_skipped_low_conf += 1
            continue

        ai_updates.append(
            (
                tx["id"],
                {
                    "categorie": suggestion.cat,
                    "aiCategorized": True,
                    "aiConfidence": suggestion.confidence,
                    "aiMethod": suggestion.method,
                },
            )
        )

        if max_updates and len(rule_updates) + len(ai_updates) >= max_updates:
            break

    applied_ai = commit_updates(db, ai_updates, dry_run=dry_run)

    summary = {
        "dryRun": dry_run,
        "transactionsLoaded": len(txs),
        "rulesLoaded": len(rules),
        "ruleTargets": len(rule_targets),
        "ruleApplied": applied_rules,
        "aiTargets": len(ai_targets),
        "aiApplied": applied_ai,
        "aiSkippedLowConfidence": ai_skipped_low_conf,
        "maxUpdates": max_updates,
        "ranAt": datetime.now(timezone.utc).isoformat(),
    }

    if not dry_run:
        db.collection("auto_categorization_runs").document().set(summary)

    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auto-catégorisation backend Firestore")
    parser.add_argument("--dry-run", action="store_true", help="N'écrit rien dans Firestore")
    parser.add_argument(
        "--max-updates",
        type=int,
        default=None,
        help="Limite de sécurité sur le nombre total de mises à jour (rules + ai)",
    )
    parser.add_argument("--verbose", action="store_true", help="Logs verbeux")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(verbose=args.verbose)
    summary = run(dry_run=args.dry_run, max_updates=args.max_updates)
    logging.info("Résumé auto-catégorisation: %s", json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
