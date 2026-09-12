"""
Smoke test de src/firebase_db.py — le module réellement exécuté par les
GitHub Actions d'import (importer.py, tronity_importer.py).

Le reste de la suite importe `firebase_db` qui, via pytest.ini
(`pythonpath = functions src`) et conftest.py, se résout vers
functions/firebase_db.py. Les ~26 fonctions présentes UNIQUEMENT dans la copie
src/ (CRUD budgets, soldes d'épargne, config Tronity, overrides dashboard,
cache de consommation, jobs reparse, flags d'import historique…) n'étaient donc
couvertes par aucun test, alors qu'elles tournent en production côté CI.

Ce smoke test charge explicitement src/firebase_db.py (sous un nom de module
distinct pour éviter la collision avec la copie functions/) et vérifie qu'il
s'importe sans erreur et expose bien sa surface publique. Il attrape les
régressions les plus probables sur ce chemin de production : erreur de syntaxe,
import cassé, suppression/renommage accidentel d'une fonction appelée par les
importeurs.
"""
import importlib.util
from pathlib import Path

import pytest

SRC_FIREBASE_DB = Path(__file__).resolve().parent.parent / "src" / "firebase_db.py"

# Fonctions présentes uniquement dans la copie src/ (absentes de functions/).
# Toute suppression/renommage casserait un importeur CI sans que la suite
# actuelle (qui charge functions/firebase_db.py) ne s'en aperçoive.
SRC_ONLY_FUNCTIONS = [
    "add_budget",
    "query_budgets",
    "get_budget_by_id",
    "update_budget_doc",
    "delete_budget_doc",
    "sauvegarder_soldes_epargne",
    "charger_config_tronity",
    "sauvegarder_config_tronity",
    "get_consumption_cache",
    "set_consumption_cache",
    "delete_consumption_cache",
    "get_all_dashboard_overrides",
    "restaurer_dashboard_overrides",
    "get_latest_balances",
    "get_transactions_by_category_period",
    "enregistrer_categories_linxo",
    "charger_emails_exclus",
    "clear_all_transactions",
    "historique_deja_importe",
    "marquer_historique_importe",
    "reset_history_import_flag",
    "lister_reparse_jobs_en_attente",
    "marquer_reparse_job",
    "upsert_gmail_messages",
    "is_firebase_available",
]


@pytest.fixture(scope="module")
def src_firebase_db():
    """Charge src/firebase_db.py sous un nom de module isolé (firebase_admin est
    déjà mocké globalement par conftest.py)."""
    spec = importlib.util.spec_from_file_location("src_firebase_db", SRC_FIREBASE_DB)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_src_firebase_db_imports_cleanly(src_firebase_db):
    assert src_firebase_db is not None


@pytest.mark.parametrize("fn_name", SRC_ONLY_FUNCTIONS)
def test_src_only_function_exists_and_callable(src_firebase_db, fn_name):
    fn = getattr(src_firebase_db, fn_name, None)
    assert fn is not None, (
        f"src/firebase_db.py n'expose plus {fn_name!r} — un importeur CI qui "
        f"l'appelle casserait en production."
    )
    assert callable(fn), f"{fn_name} n'est pas appelable"
