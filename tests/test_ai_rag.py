"""Tests unitaires pour src/ai_rag.py — cœur pur de la catégorisation RAG."""
from datetime import datetime, timezone

from ai_rag import (
    SENTINEL,
    allowed_categories,
    build_categorization_prompt,
    confidence_from_examples,
    parse_category_answer,
    retrieve_similar_examples,
)

NOW = datetime(2026, 6, 13, tzinfo=timezone.utc).timestamp()


def _tx(libelle="", categorie=None, montant=-10, date="2026-06-01", compte="LCL", id=None):
    return {
        "id": id,
        "libelle": libelle,
        "categorie": categorie,
        "montant": montant,
        "date": date,
        "compte": compte,
    }


# ── retrieve_similar_examples ────────────────────────────────────────────────

def test_retrieves_history_sharing_tokens():
    history = [
        _tx(id="1", libelle="CARREFOUR MARKET PARIS", categorie="Courses"),
        _tx(id="2", libelle="NETFLIX.COM", categorie="Loisirs"),
        _tx(id="3", libelle="CARREFOUR CITY LYON", categorie="Courses"),
    ]
    res = retrieve_similar_examples(_tx(id="new", libelle="CARREFOUR EXPRESS"), history, k=5, now_ts=NOW)
    assert [e["categorie"] for e in res] == ["Courses", "Courses"]
    assert not any("NETFLIX" in e["libelle"] for e in res)


def test_exact_label_beats_partial_overlap():
    history = [
        _tx(id="1", libelle="MONOPRIX RIVOLI 75", categorie="Courses"),
        _tx(id="2", libelle="MONOPRIX", categorie="Alimentation"),
    ]
    res = retrieve_similar_examples(_tx(id="new", libelle="MONOPRIX"), history, k=5, now_ts=NOW)
    assert res[0]["categorie"] == "Alimentation"


def test_excludes_uncategorized_and_self():
    history = [
        _tx(id="new", libelle="SPOTIFY", categorie="Loisirs"),         # même id que cible
        _tx(id="2", libelle="SPOTIFY AB", categorie="A Catégoriser"),
        _tx(id="3", libelle="SPOTIFY P", categorie=""),
    ]
    res = retrieve_similar_examples(_tx(id="new", libelle="SPOTIFY"), history, k=5, now_ts=NOW)
    assert res == []


def test_no_overlap_returns_nothing():
    history = [_tx(id="1", libelle="EDF FACTURE", categorie="Énergie")]
    res = retrieve_similar_examples(_tx(id="new", libelle="BOULANGERIE"), history, k=5, now_ts=NOW)
    assert res == []


def test_caps_at_k_and_deduplicates_identical():
    history = [_tx(id=str(i), libelle="UBER EATS", categorie="Restaurant") for i in range(10)]
    res = retrieve_similar_examples(_tx(id="new", libelle="UBER EATS"), history, k=5, now_ts=NOW)
    assert len(res) == 1  # tous identiques → dédupliqués


# ── allowed_categories ──────────────────────────────────────────────────────

def test_allowed_categories_sorted_distinct():
    examples = [
        {"libelle": "a", "categorie": "Courses", "montant": -1, "score": 1},
        {"libelle": "b", "categorie": "Énergie", "montant": -1, "score": 1},
        {"libelle": "c", "categorie": "Courses", "montant": -1, "score": 1},
    ]
    assert allowed_categories(examples) == ["Courses", "Énergie"]


# ── build_categorization_prompt ─────────────────────────────────────────────

def test_prompt_lists_allowed_and_examples_and_constrains_output():
    examples = [
        {"libelle": "CARREFOUR", "categorie": "Courses", "montant": -42.3, "score": 3},
        {"libelle": "LIDL", "categorie": "Courses", "montant": -18, "score": 2},
    ]
    system, user, allowed = build_categorization_prompt(
        _tx(libelle="MONOPRIX", montant=-25), examples
    )
    assert allowed == ["Courses"]
    assert SENTINEL in system
    assert "Catégories autorisées : Courses" in user
    assert "CARREFOUR" in user and "MONOPRIX" in user


# ── parse_category_answer ───────────────────────────────────────────────────

def test_parse_exact_match():
    assert parse_category_answer("Courses", ["Courses", "Restaurant"]) == "Courses"


def test_parse_tolerates_decor_and_accents():
    allowed = ["Courses", "Énergie", "Restaurant"]
    assert parse_category_answer('- "courses".', allowed) == "Courses"
    assert parse_category_answer("energie", allowed) == "Énergie"


def test_parse_keeps_only_first_line():
    assert parse_category_answer("Restaurant\nparce que ...", ["Restaurant"]) == "Restaurant"


def test_parse_rejects_sentinel_and_unknown():
    allowed = ["Courses", "Restaurant"]
    assert parse_category_answer("INCONNU", allowed) is None
    assert parse_category_answer("Voyages", allowed) is None
    assert parse_category_answer("", allowed) is None


# ── confidence_from_examples ────────────────────────────────────────────────

def test_confidence_high_when_all_agree():
    examples = [
        {"libelle": "a", "categorie": "Courses", "montant": -1, "score": 4},
        {"libelle": "b", "categorie": "Courses", "montant": -1, "score": 2},
    ]
    assert confidence_from_examples("Courses", examples) == 95


def test_confidence_proportional_to_score_share():
    examples = [
        {"libelle": "a", "categorie": "Courses", "montant": -1, "score": 3},
        {"libelle": "b", "categorie": "Restaurant", "montant": -1, "score": 1},
    ]
    assert confidence_from_examples("Courses", examples) == 75


def test_confidence_zero_without_examples():
    assert confidence_from_examples("Courses", []) == 0
