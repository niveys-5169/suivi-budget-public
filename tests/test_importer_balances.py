"""Tests for balance update in src/importer.py.

Regression guard: the Linxo email importer must write the parsed balance
DIRECTLY into account_balances (via sauvegarder_soldes_comptes) so the UI
(which listens to account_balances) updates. It must NOT defer to the
proposed_account_balances staging collection.

conftest.py forces `functions/` ahead of `src/` on sys.path and mocks
firebase_admin globally, so `import importer` would resolve the wrong sibling
modules. We therefore load src/importer.py explicitly by file path (same
convention as `_load_src_firebase_db` in test_firebase_db.py).
"""
import importlib.util
import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))


# Modules que importer.py résout par import absolu ; ils existent en double
# (functions/ et src/). On les charge en version src/ puis on RESTAURE l'état
# global de sys.modules, pour ne pas casser les fichiers de test voisins
# (ex. test_main_linxo_import.py) qui s'attendent aux versions functions/.
_SRC_MODULES = ("firebase_db", "gmail_client", "transaction_parser", "dedup", "importer")


def _load_src_importer():
    """Charge src/importer.py avec ses dépendances src/, sans polluer sys.modules."""
    saved = {name: sys.modules.get(name) for name in _SRC_MODULES}
    sys.path.insert(0, SRC_DIR)
    for name in _SRC_MODULES:
        sys.modules.pop(name, None)
    try:
        spec = importlib.util.spec_from_file_location(
            "importer", os.path.join(SRC_DIR, "importer.py")
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        # `module` a déjà lié ses dépendances (sauvegarder_soldes_comptes, etc.)
        # dans son namespace ; on peut donc le patcher même après restauration.
        return module
    finally:
        if sys.path and sys.path[0] == SRC_DIR:
            sys.path.pop(0)
        for name, mod in saved.items():
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod


# Chargé une seule fois : recharger le module par chemin à chaque test crée
# des objets-module distincts, si bien que patch.object(importer, "GmailClient")
# ne viserait pas le même namespace que celui utilisé par main() au test suivant.
_IMPORTER = _load_src_importer()


@pytest.fixture
def importer():
    return _IMPORTER


def _make_gmail():
    gmail = MagicMock()
    gmail.search_emails.return_value = [{"id": "m1"}]
    gmail.get_message_html.return_value = {
        "html": "<html></html>",
        "internalDate": 1704067200000,  # 2024-01-01
        "threadId": "t1",
        "subject": "Notification",
    }
    gmail.get_message_metadata.return_value = {
        "internalDate": 1704067200000,
        "threadId": "t1",
        "subject": "Notification",
    }
    return gmail


def _run(importer, txs, soldes, coherence):
    """Run importer.main() with every external dependency stubbed."""
    os.environ.pop("DISABLE_LINXO_IMPORT", None)
    save_soldes = MagicMock(return_value=len(soldes))
    db = MagicMock()

    with patch.object(importer, "get_credentials", return_value=MagicMock()), \
         patch.object(importer, "GmailClient", return_value=_make_gmail()), \
         patch.object(importer, "is_firebase_available", return_value=True), \
         patch.object(importer, "charger_mapping_categories_linxo", return_value={}), \
         patch.object(importer, "parse_email_linxo", return_value=(txs, soldes)), \
         patch.object(importer, "charger_transactions_existantes_pour_dedoublonnage", return_value=[]), \
         patch.object(importer, "deduplicate", side_effect=lambda new, old: (new, [], [])), \
         patch.object(importer, "sauvegarder_transactions", return_value=len(txs)), \
         patch.object(importer, "calcul_coherence_solde", return_value=coherence), \
         patch.object(importer, "sauvegarder_soldes_comptes", save_soldes), \
         patch.object(importer, "_get_db", return_value=db), \
         patch.object(importer, "charger_emails_exclus", return_value=set()), \
         patch.object(importer, "lister_reparse_jobs_en_attente", return_value=[]), \
         patch.object(importer, "marquer_reparse_job"), \
         patch.object(importer, "upsert_gmail_messages"):
        importer.main()

    return save_soldes, db


_NO_PREVIOUS = {"previousSolde": None, "computedSolde": None, "linxoDelta": None, "ecart": None}


def _solde(compte="BforBank Compte Courant", value=1234.56):
    return [{
        "compte": compte,
        "solde": value,
        "emailDate": datetime(2024, 1, 1, tzinfo=timezone.utc),
        "status": "OK",
    }]


def test_balance_written_directly_to_account_balances(importer):
    """A parsed Linxo balance is persisted via sauvegarder_soldes_comptes."""
    save_soldes, _ = _run(importer, txs=[], soldes=_solde(), coherence=_NO_PREVIOUS)

    save_soldes.assert_called_once()
    written = save_soldes.call_args.args[0]
    assert len(written) == 1
    assert written[0]["compte"] == "BforBank"   # mapped to budget account name
    assert written[0]["solde"] == 1234.56        # parsed balance, written verbatim
    assert written[0]["status"] == "reconciled"  # modern enum, not "UNKNOWN"


def test_does_not_write_to_proposed_account_balances(importer):
    """The staging collection (async trigger flow) must no longer be used."""
    _, db = _run(importer, txs=[], soldes=_solde(), coherence=_NO_PREVIOUS)

    proposed_calls = [
        c for c in db.collection.call_args_list
        if c.args and c.args[0] == "proposed_account_balances"
    ]
    assert proposed_calls == []


def test_status_pending_review_on_discrepancy(importer):
    """When the audit gap is non-zero, the account is flagged pending_review."""
    coherence = {
        "previousSolde": 900.0,
        "computedSolde": 950.0,
        "linxoDelta": 50.0,
        "ecart": 50.0,
    }
    save_soldes, _ = _run(importer, txs=[], soldes=_solde(value=1000.0), coherence=coherence)

    written = save_soldes.call_args.args[0][0]
    assert written["status"] == "pending_review"
    assert written["ecart"] == 50.0


def _run_two_mails(importer, soldes_par_mail):
    """Run main() avec deux mails Linxo. `soldes_par_mail` = [(internalDate_ms, soldes), ...]
    dans l'ordre renvoyé par search_emails. Retourne (save_soldes, coherence_mock)."""
    os.environ.pop("DISABLE_LINXO_IMPORT", None)
    save_soldes = MagicMock(return_value=len(soldes_par_mail))

    gmail = MagicMock()
    gmail.search_emails.return_value = [{"id": f"m{i}"} for i in range(len(soldes_par_mail))]
    html_by_id = {
        f"m{i}": {
            "html": "<html></html>",
            "internalDate": internal_ms,
            "threadId": f"t{i}",
            "subject": "Notification",
        }
        for i, (internal_ms, _soldes) in enumerate(soldes_par_mail)
    }
    gmail.get_message_html.side_effect = lambda msg_id: html_by_id[msg_id]
    parse_by_id = {f"m{i}": ([], soldes) for i, (_ms, soldes) in enumerate(soldes_par_mail)}
    # parse_email_linxo(html, CONFIG) — appelé dans l'ordre des messages
    parse_calls = iter([parse_by_id[f"m{i}"] for i in range(len(soldes_par_mail))])

    coherence_mock = MagicMock(
        return_value={"previousSolde": 900.0, "computedSolde": 0.0, "linxoDelta": 0.0, "ecart": 0.0}
    )

    with patch.object(importer, "get_credentials", return_value=MagicMock()), \
         patch.object(importer, "GmailClient", return_value=gmail), \
         patch.object(importer, "is_firebase_available", return_value=True), \
         patch.object(importer, "charger_mapping_categories_linxo", return_value={}), \
         patch.object(importer, "parse_email_linxo", side_effect=lambda *a, **k: next(parse_calls)), \
         patch.object(importer, "charger_transactions_existantes_pour_dedoublonnage", return_value=[]), \
         patch.object(importer, "deduplicate", side_effect=lambda new, old: (new, [], [])), \
         patch.object(importer, "sauvegarder_transactions", return_value=0), \
         patch.object(importer, "calcul_coherence_solde", coherence_mock), \
         patch.object(importer, "sauvegarder_soldes_comptes", save_soldes), \
         patch.object(importer, "_get_db", return_value=MagicMock()), \
         patch.object(importer, "charger_emails_exclus", return_value=set()), \
         patch.object(importer, "lister_reparse_jobs_en_attente", return_value=[]), \
         patch.object(importer, "marquer_reparse_job"), \
         patch.object(importer, "upsert_gmail_messages"):
        importer.main()

    return save_soldes, coherence_mock


def test_transactions_scanned_once_for_multiple_soldes(importer):
    """RÉGRESSION : la collection `transactions` doit être scannée UNE SEULE fois
    par run pour le contrôle de cohérence, même avec plusieurs soldes/comptes à
    traiter, et non une fois par solde via calcul_coherence_solde."""
    os.environ.pop("DISABLE_LINXO_IMPORT", None)
    save_soldes = MagicMock(return_value=2)
    scan_mock = MagicMock(return_value=[
        {"compte": "BforBank", "montant": -10.0, "date": "2024-01-01", "emailDate": None},
        {"compte": "LCL", "montant": 100.0, "date": "2024-01-01", "emailDate": None},
    ])
    coherence_mock = MagicMock(return_value=_NO_PREVIOUS)
    soldes = [
        {"compte": "BforBank Compte Courant", "solde": 1234.56,
         "emailDate": datetime(2024, 1, 1, tzinfo=timezone.utc), "status": "OK"},
        {"compte": "LCL Compte Joint", "solde": 500.0,
         "emailDate": datetime(2024, 1, 1, tzinfo=timezone.utc), "status": "OK"},
    ]

    with patch.object(importer, "get_credentials", return_value=MagicMock()), \
         patch.object(importer, "GmailClient", return_value=_make_gmail()), \
         patch.object(importer, "is_firebase_available", return_value=True), \
         patch.object(importer, "charger_mapping_categories_linxo", return_value={}), \
         patch.object(importer, "parse_email_linxo", return_value=([], soldes)), \
         patch.object(importer, "charger_transactions_existantes_pour_dedoublonnage", scan_mock), \
         patch.object(importer, "deduplicate", side_effect=lambda new, old: (new, [], [])), \
         patch.object(importer, "sauvegarder_transactions", return_value=0), \
         patch.object(importer, "calcul_coherence_solde", coherence_mock), \
         patch.object(importer, "sauvegarder_soldes_comptes", save_soldes), \
         patch.object(importer, "_get_db", return_value=MagicMock()), \
         patch.object(importer, "charger_emails_exclus", return_value=set()), \
         patch.object(importer, "lister_reparse_jobs_en_attente", return_value=[]), \
         patch.object(importer, "marquer_reparse_job"), \
         patch.object(importer, "upsert_gmail_messages"):
        importer.main()

    # Un seul scan complet (since_days=0), malgré 2 soldes traités. `nouvelles_transactions`
    # est vide ici donc le seul appel à charger_transactions_existantes_pour_dedoublonnage
    # est celui du contrôle de cohérence.
    scan_mock.assert_called_once_with(since_days=0)

    assert coherence_mock.call_count == 2
    for call in coherence_mock.call_args_list:
        assert "tx_all" in call.kwargs


def test_multi_mails_meme_jour_persiste_le_solde_le_plus_recent(importer):
    """Deux mails Linxo le même compte : le plus récent doit l'emporter dans
    account_balances, peu importe l'ordre de réception, et chaque contrôle de
    cohérence est borné par l'emailDate de son propre mail (upper_email_date)."""
    newer_ms = 1704153600000  # 2024-01-02 (mail le plus récent)
    older_ms = 1704067200000  # 2024-01-01
    compte = "BforBank Compte Courant"

    # search_emails renvoie le plus récent EN PREMIER -> sans tri, l'ancien écraserait.
    save_soldes, coherence_mock = _run_two_mails(
        importer,
        soldes_par_mail=[
            (newer_ms, [{"compte": compte, "solde": 950.0, "emailDate": None, "status": "OK"}]),
            (older_ms, [{"compte": compte, "solde": 980.0, "emailDate": None, "status": "OK"}]),
        ],
    )

    written = save_soldes.call_args.args[0]
    bfor = [w for w in written if w["compte"] == "BforBank"]
    # Le dernier solde écrit pour le compte (celui qui "gagne") doit être le plus récent.
    assert bfor[-1]["solde"] == 950.0

    # Chaque appel de cohérence est borné par l'emailDate de son propre solde.
    for call in coherence_mock.call_args_list:
        assert call.kwargs.get("upper_email_date") is not None
        # upper_email_date == emailDate passé comme 3e argument positionnel (email_date)
        assert call.kwargs["upper_email_date"] == call.args[2]
