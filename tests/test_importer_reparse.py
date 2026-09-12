"""Tests du câblage Reparse Gmail dans src/importer.py.

Couvre :
  - le filtre d'exclusion gmail_excluded (mail listé mais ni collecté ni étiqueté) ;
  - le consommateur de reparse_jobs (reparse par messageId + full_scan_request) ;
  - le marquage done/error des jobs.

Même convention de chargement que test_importer_balances.py : src/importer.py est
chargé par chemin pour ne pas résoudre les modules jumeaux de functions/.
"""
import importlib.util
import os
import sys
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))

_SRC_MODULES = ("firebase_db", "gmail_client", "transaction_parser", "dedup", "importer")


def _load_src_importer():
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
        return module
    finally:
        if sys.path and sys.path[0] == SRC_DIR:
            sys.path.pop(0)
        for name, mod in saved.items():
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod


_IMPORTER = _load_src_importer()


@pytest.fixture
def importer():
    return _IMPORTER


def _html(msg_id):
    return {
        "html": f"<html>{msg_id}</html>",
        "internalDate": 1704067200000,  # 2024-01-01
        "threadId": "t1",
        "subject": "Notification",
    }


def _tx(compte="BforBank Compte Courant", libelle="Carrefour", montant=-12.0):
    return {
        "compteLinxo": compte,
        "libelle": libelle,
        "montant": montant,
        "date": datetime(2024, 1, 1),
        "categorieLinxo": "",
        "enAttente": False,
    }


def _patches(importer, gmail, *, excluded=None, jobs=None, save_tx=None, mark=None):
    """Contexte de patch commun. Renvoie la liste des context managers à ouvrir."""
    save_tx = save_tx if save_tx is not None else MagicMock(return_value=0)
    mark = mark if mark is not None else MagicMock()
    return [
        patch.object(importer, "get_credentials", return_value=MagicMock()),
        patch.object(importer, "GmailClient", return_value=gmail),
        patch.object(importer, "is_firebase_available", return_value=True),
        patch.object(importer, "charger_mapping_categories_linxo", return_value={}),
        patch.object(importer, "charger_transactions_existantes_pour_dedoublonnage", return_value=[]),
        patch.object(importer, "deduplicate", side_effect=lambda new, old: (new, [], [])),
        patch.object(importer, "reconcile_pending", side_effect=lambda new, old: (new, [])),
        patch.object(importer, "sauvegarder_transactions", save_tx),
        patch.object(importer, "supprimer_transactions_par_ids"),
        patch.object(importer, "charger_transactions_categorisees", return_value=[]),
        patch.object(importer, "charger_recurrences_actives", return_value=[]),
        patch.object(importer, "categorize_batch"),
        patch.object(importer, "sauvegarder_soldes_comptes"),
        patch.object(importer, "_get_db", return_value=MagicMock()),
        patch.object(importer, "upsert_gmail_messages"),
        patch.object(importer, "charger_emails_exclus", return_value=excluded or set()),
        patch.object(importer, "lister_reparse_jobs_en_attente", return_value=jobs or []),
        patch.object(importer, "marquer_reparse_job", mark),
    ]


def _run(importer, gmail, ctx):
    os.environ.pop("DISABLE_LINXO_IMPORT", None)
    from contextlib import ExitStack
    with ExitStack() as stack:
        for cm in ctx:
            stack.enter_context(cm)
        importer.main()


def test_excluded_email_not_imported_nor_labelled(importer):
    """Un mail dans gmail_excluded n'est ni sauvegardé ni étiqueté, mais reste
    listé pour l'UI (upsert_gmail_messages)."""
    gmail = MagicMock()
    gmail.search_emails.return_value = [{"id": "m1"}]
    gmail.get_message_html.side_effect = lambda mid: _html(mid)
    gmail.get_message_metadata.return_value = {
        "internalDate": 1704067200000, "threadId": "t1", "subject": "Notification",
    }
    save_tx = MagicMock(return_value=1)

    with patch.object(importer, "parse_email_linxo", return_value=([_tx()], [])):
        _run(importer, gmail, _patches(importer, gmail, excluded={"m1"}, save_tx=save_tx))

    save_tx.assert_not_called()          # rien de collecté depuis un mail exclu
    gmail.add_label.assert_not_called()  # donc pas d'étiquetage Linxo_Importé


def test_reparse_job_reimports_specific_message(importer):
    """Un job reparse sur un messageId réimporte ce mail et marque le job done."""
    gmail = MagicMock()
    gmail.search_emails.return_value = []          # aucun mail non-traité au run normal
    gmail.get_message_html.side_effect = lambda mid: _html(mid)
    save_tx = MagicMock(return_value=1)
    mark = MagicMock()
    jobs = [{"id": "abc123", "messageId": "abc123", "status": "requested"}]

    with patch.object(importer, "parse_email_linxo", return_value=([_tx()], [])):
        _run(importer, gmail, _patches(importer, gmail, jobs=jobs, save_tx=save_tx, mark=mark))

    gmail.get_message_html.assert_any_call("abc123")
    save_tx.assert_called_once()
    mark.assert_called_once()
    assert mark.call_args.args[0] == "abc123"
    assert mark.call_args.args[1] == "done"


def test_full_scan_job_reparses_all(importer):
    """full_scan_request rejoue tous les mails Linxo puis marque la sentinelle done."""
    gmail = MagicMock()
    # search_emails est appelé 3× : run normal (vide), sync de la liste Reparse
    # (vide), puis reparse_query du full-scan.
    gmail.search_emails.side_effect = [[], [], [{"id": "x1"}, {"id": "x2"}]]
    gmail.get_message_html.side_effect = lambda mid: _html(mid)
    save_tx = MagicMock(return_value=2)
    mark = MagicMock()
    jobs = [{"id": "full_scan_request", "status": "requested"}]

    with patch.object(importer, "parse_email_linxo", return_value=([_tx()], [])):
        _run(importer, gmail, _patches(importer, gmail, jobs=jobs, save_tx=save_tx, mark=mark))

    gmail.get_message_html.assert_any_call("x1")
    gmail.get_message_html.assert_any_call("x2")
    assert mark.call_args.args[0] == "full_scan_request"
    assert mark.call_args.args[1] == "done"


def test_reparse_compare_tout_lhistorique_et_sans_probables(importer):
    """RÉGRESSION INCIDENT 28/07 : un reparse rejoue des mails DÉJÀ importés.

    Il doit donc dédupliquer contre TOUT l'historique (since_days=0) et ne pas
    réinjecter les quasi-doublons. Avec la fenêtre de 60 j et les probables, le
    « Scanner tout » avait réécrit 300 transactions dont 286 en double."""
    gmail = MagicMock()
    gmail.search_emails.return_value = []
    gmail.get_message_html.side_effect = lambda mid: _html(mid)
    persister = MagicMock(return_value=0)
    jobs = [{"id": "abc123", "messageId": "abc123", "status": "requested"}]

    with patch.object(importer, "parse_email_linxo", return_value=([_tx()], [])), \
         patch.object(importer, "_persister", persister):
        _run(importer, gmail, _patches(importer, gmail, jobs=jobs))

    # 1er appel = run incrémental normal -> valeurs par défaut (60 j, probables inclus)
    assert persister.call_args_list[0].kwargs.get("dedup_since_days", 60) == 60
    assert persister.call_args_list[0].kwargs.get("admettre_probables", True) is True

    # 2e appel = job de reparse -> historique complet, sans probables
    reparse_call = persister.call_args_list[-1]
    assert reparse_call.kwargs["dedup_since_days"] == 0
    assert reparse_call.kwargs["admettre_probables"] is False


def test_reparse_job_failure_marked_error(importer):
    """Une exception pendant le reparse marque le job en error, sans planter le run."""
    gmail = MagicMock()
    gmail.search_emails.return_value = []
    gmail.get_message_html.side_effect = RuntimeError("Gmail down")
    mark = MagicMock()
    jobs = [{"id": "boom", "messageId": "boom", "status": "requested"}]

    with patch.object(importer, "parse_email_linxo", return_value=([], [])):
        _run(importer, gmail, _patches(importer, gmail, jobs=jobs, mark=mark))

    assert mark.call_args.args[0] == "boom"
    assert mark.call_args.args[1] == "error"
