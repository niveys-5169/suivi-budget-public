"""Tests unitaires du moteur de catégorisation automatique backend.

Cible les fonctions pures de src/auto_categorize_backend.py (normalisation,
tokenisation, scoring de récence, construction du modèle heuristique,
suggestion de catégorie et évaluation des règles) — chemins d'ingestion
d'argent réel exécutés en GitHub Actions, jusqu'ici non testés.
"""

from datetime import datetime, timezone
import unittest

from auto_categorize_backend import (
    normalize_label,
    tokenize_label,
    score_by_recency,
    build_category_model,
    suggest_category,
    matches_rule,
    is_uncategorized,
)


class NormalizeLabelTests(unittest.TestCase):
    def test_lowercases_and_strips(self):
        self.assertEqual(normalize_label("  CARREFOUR  "), "carrefour")

    def test_removes_accents(self):
        self.assertEqual(normalize_label("Épicerie Crédité"), "epicerie credite")

    def test_replaces_punctuation_with_space(self):
        self.assertEqual(normalize_label("SNCF-TGV/PARIS"), "sncf tgv paris")

    def test_collapses_whitespace(self):
        self.assertEqual(normalize_label("a    b\tc"), "a b c")

    def test_none_returns_empty(self):
        self.assertEqual(normalize_label(None), "")


class TokenizeLabelTests(unittest.TestCase):
    def test_keeps_words_longer_than_two_chars(self):
        self.assertEqual(tokenize_label("carrefour market"), ["carrefour", "market"])

    def test_drops_short_tokens(self):
        self.assertEqual(tokenize_label("le su carrefour"), ["carrefour"])

    def test_drops_pure_digits(self):
        self.assertEqual(tokenize_label("carrefour 1234"), ["carrefour"])


class ScoreByRecencyTests(unittest.TestCase):
    def setUp(self):
        self.now_ts = datetime(2026, 7, 1, tzinfo=timezone.utc).timestamp()

    def test_missing_date_returns_baseline(self):
        self.assertEqual(score_by_recency(None, self.now_ts), 1.0)

    def test_invalid_date_returns_baseline(self):
        self.assertEqual(score_by_recency("not-a-date", self.now_ts), 1.0)

    def test_recent_within_90_days_scores_highest(self):
        self.assertEqual(score_by_recency("2026-06-01", self.now_ts), 2.0)

    def test_within_one_year(self):
        self.assertEqual(score_by_recency("2025-10-01", self.now_ts), 1.5)

    def test_within_two_years(self):
        self.assertEqual(score_by_recency("2024-10-01", self.now_ts), 1.2)

    def test_older_than_two_years_scores_baseline(self):
        self.assertEqual(score_by_recency("2020-01-01", self.now_ts), 1.0)


class BuildModelAndSuggestTests(unittest.TestCase):
    def _history(self):
        return [
            {"libelle": "CARREFOUR MARKET", "categorie": "Courses", "montant": -42.0, "date": "2026-06-15", "compte": "BforBank"},
            {"libelle": "CARREFOUR MARKET", "categorie": "Courses", "montant": -30.0, "date": "2026-06-20", "compte": "BforBank"},
            {"libelle": "SALAIRE ACME", "categorie": "Revenus", "montant": 2500.0, "date": "2026-06-28", "compte": "BforBank"},
            {"libelle": "A Catégoriser noise", "categorie": "A Catégoriser", "montant": -5.0, "date": "2026-06-01", "compte": "BforBank"},
        ]

    def test_uncategorized_rows_excluded_from_model(self):
        model = build_category_model(self._history())
        # "noise" ne doit apparaître dans aucun bucket de mots
        self.assertNotIn("noise", model["wordCats"])

    def test_exact_label_suggestion_high_confidence(self):
        model = build_category_model(self._history())
        tx = {"libelle": "CARREFOUR MARKET", "montant": -12.0, "compte": "BforBank"}
        suggestion = suggest_category(tx, model)
        self.assertIsNotNone(suggestion)
        self.assertEqual(suggestion.cat, "Courses")
        self.assertEqual(suggestion.method, "exact")
        self.assertGreaterEqual(suggestion.confidence, 72)

    def test_word_level_suggestion_for_unseen_label(self):
        model = build_category_model(self._history())
        tx = {"libelle": "SALAIRE MENSUEL", "montant": 2000.0, "compte": "BforBank"}
        suggestion = suggest_category(tx, model)
        self.assertIsNotNone(suggestion)
        self.assertEqual(suggestion.cat, "Revenus")

    def test_short_label_returns_none(self):
        model = build_category_model(self._history())
        self.assertIsNone(suggest_category({"libelle": "ab", "montant": -1.0}, model))

    def test_unknown_label_returns_none(self):
        model = build_category_model(self._history())
        tx = {"libelle": "ZZZ INCONNU TOTAL", "montant": -1.0, "compte": "BforBank"}
        self.assertIsNone(suggest_category(tx, model))


class MatchesRuleTests(unittest.TestCase):
    def test_disabled_rule_never_matches(self):
        rule = {"enabled": False, "pattern": "carrefour", "matchType": "contains"}
        self.assertFalse(matches_rule(rule, {"libelle": "CARREFOUR MARKET"}))

    def test_empty_pattern_never_matches(self):
        self.assertFalse(matches_rule({"pattern": ""}, {"libelle": "CARREFOUR"}))

    def test_contains_default_case_insensitive(self):
        rule = {"pattern": "carrefour"}
        self.assertTrue(matches_rule(rule, {"libelle": "PAIEMENT CARREFOUR CB"}))

    def test_exact_match(self):
        rule = {"pattern": "carrefour", "matchType": "exact"}
        self.assertTrue(matches_rule(rule, {"libelle": "Carrefour"}))
        self.assertFalse(matches_rule(rule, {"libelle": "Carrefour Market"}))

    def test_starts_with(self):
        rule = {"pattern": "sncf", "matchType": "startsWith"}
        self.assertTrue(matches_rule(rule, {"libelle": "SNCF TGV"}))
        self.assertFalse(matches_rule(rule, {"libelle": "PAIEMENT SNCF"}))

    def test_regex_match(self):
        rule = {"pattern": r"amazon\s*\d+", "matchType": "regex"}
        self.assertTrue(matches_rule(rule, {"libelle": "AMAZON 1234"}))

    def test_invalid_regex_returns_false(self):
        rule = {"pattern": "[unclosed", "matchType": "regex"}
        self.assertFalse(matches_rule(rule, {"libelle": "anything"}))

    def test_account_filter_blocks_mismatch(self):
        rule = {"pattern": "carrefour", "compte": "BforBank"}
        self.assertFalse(matches_rule(rule, {"libelle": "CARREFOUR", "compte": "Boursorama"}))
        self.assertTrue(matches_rule(rule, {"libelle": "CARREFOUR", "compte": "BforBank"}))


class IsUncategorizedTests(unittest.TestCase):
    def test_empty_is_uncategorized(self):
        self.assertTrue(is_uncategorized({"categorie": ""}))

    def test_placeholder_is_uncategorized(self):
        self.assertTrue(is_uncategorized({"categorie": "A Catégoriser"}))

    def test_missing_key_is_uncategorized(self):
        self.assertTrue(is_uncategorized({}))

    def test_real_category_is_not_uncategorized(self):
        self.assertFalse(is_uncategorized({"categorie": "Courses"}))


if __name__ == "__main__":
    unittest.main()
