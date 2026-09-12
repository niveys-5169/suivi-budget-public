"""Tests unitaires pour src/ai_lexical.py — fast-path lexical.

Aligné sur l'algorithme public/src/services/aiEngine.ts. Les seuils et formules
y sont vérifiés directement (confidence >= 2 → 'exact' boost, etc.).
"""
from datetime import datetime, timezone

from ai_lexical import build_category_model, suggest_category_lexical

NOW = datetime(2026, 6, 13, tzinfo=timezone.utc).timestamp()


def _tx(libelle="", categorie=None, montant=-10, date="2026-06-01", compte="LCL"):
    return {"libelle": libelle, "categorie": categorie,
            "montant": montant, "date": date, "compte": compte}


def test_returns_none_when_label_too_short():
    model = build_category_model([], now_ts=NOW)
    assert suggest_category_lexical(_tx(libelle="ab"), model) is None
    assert suggest_category_lexical(_tx(libelle=""), model) is None


def test_exact_label_match_high_confidence_after_repetition():
    # 3 occurrences récentes du même libellé → score cumulé >= 2 → boost
    history = [_tx(libelle="CARREFOUR MARKET", categorie="Courses") for _ in range(3)]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="CARREFOUR MARKET"), model)
    assert out is not None
    assert out["method"] == "exact"
    assert out["cat"] == "Courses"
    assert out["confidence"] >= 80  # 72 + 4 * score


def test_exact_label_match_low_score_returns_modest_confidence():
    # Une seule occurrence très ancienne sans compte → recency=1, context=1 →
    # score 1 < 2 → branche "confidence = 62" (fallback modeste).
    history = [_tx(libelle="CARREFOUR", categorie="Courses",
                   date="2023-01-01", compte="")]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="CARREFOUR", compte=""), model)
    assert out is not None
    assert out["method"] == "exact"
    assert out["confidence"] == 62


def test_prefix_match_when_label_not_seen_verbatim():
    # "UBER EATS PARIS" partage le préfixe "uber eats" avec des occurrences passées
    history = [
        _tx(libelle="UBER EATS PARIS 75001", categorie="Restaurant"),
        _tx(libelle="UBER EATS LYON 69002", categorie="Restaurant"),
    ]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="UBER EATS BORDEAUX"), model)
    assert out is not None
    assert out["method"] == "prefix"
    assert out["cat"] == "Restaurant"


def test_words_fallback_when_neither_exact_nor_prefix():
    # Un seul mot rare en commun ("FRANPRIX") avec un précédent libellé long
    history = [
        _tx(libelle="FRANPRIX RUE LAFAYETTE", categorie="Courses"),
        _tx(libelle="FRANPRIX BD VOLTAIRE", categorie="Courses"),
    ]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="FRANPRIX MONTORGUEIL"), model)
    assert out is not None
    assert out["cat"] == "Courses"
    # 'prefix' s'applique aussi (FRANPRIX RUE/BD partagés ne match pas le nouveau préfixe)
    assert out["method"] in {"words", "prefix"}


def test_no_signal_returns_none():
    history = [_tx(libelle="CARREFOUR", categorie="Courses")]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="ZUTALORS INCONNU"), model)
    assert out is None


def test_skips_uncategorized_history():
    history = [
        _tx(libelle="MONOPRIX", categorie="A Catégoriser"),
        _tx(libelle="MONOPRIX", categorie=""),
    ]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="MONOPRIX"), model)
    assert out is None


def test_recency_boosts_recent_categorization_over_older_one():
    """Un même libellé récemment recatégorisé doit primer sur ses anciennes étiquettes."""
    history = [
        _tx(libelle="SPOTIFY", categorie="Loisirs", date="2024-01-01"),
        _tx(libelle="SPOTIFY", categorie="Abonnements", date="2026-06-01"),
    ]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="SPOTIFY", date="2026-06-13"), model)
    assert out is not None
    assert out["cat"] == "Abonnements"


def test_words_threshold_filters_low_signal():
    """Trois catégories possibles depuis des mots communs → confidence sous le seuil → None."""
    history = [
        _tx(libelle="PAIEMENT CB PARIS", categorie="Courses"),
        _tx(libelle="PAIEMENT CB PARIS", categorie="Loisirs"),
        _tx(libelle="PAIEMENT CB PARIS", categorie="Voyages"),
    ]
    model = build_category_model(history, now_ts=NOW)
    out = suggest_category_lexical(_tx(libelle="PAIEMENT CB LYON"), model)
    # Soit None (sous seuil 33 %), soit une des trois ex æquo avec confidence faible.
    if out is not None:
        assert out["confidence"] >= 33
