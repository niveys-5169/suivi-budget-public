"""Tests pour le flux d'import Linxo (`functions/main.py`).

Vérifie que les soldes parsés sont écrits DIRECTEMENT dans `account_balances`
(via `sauvegarder_soldes_comptes`), collection écoutée par l'UI — et non plus
dans une collection de staging déclenchant un moteur de réconciliation.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mocked_main(mocker, functions_import_path):
    """Importe et mocke `functions.main` avec ses dépendances Firestore."""
    with functions_import_path():
        mocker.patch("main.charger_mapping_categories_linxo", return_value={})
        mocker.patch("main.charger_ids_emails_traites", return_value=set())
        mocker.patch("main.marquer_email_traite")
        mocker.patch("main.sauvegarder_transactions", return_value=1)

        # Premier solde connu pour le compte -> aucun écart, statut reconciled.
        mocker.patch("main.calcul_coherence_solde", return_value={
            "previousSolde": None, "computedSolde": None, "linxoDelta": None, "ecart": None,
        })
        save_soldes = mocker.patch("main.sauvegarder_soldes_comptes", return_value=1)

        email_dt = datetime(2026, 5, 15, 7, 30, tzinfo=timezone.utc)
        internal_date_ms = int(email_dt.timestamp() * 1000)

        gmail = MagicMock()
        gmail.search_emails.return_value = [{"id": "msg-1"}]
        gmail.get_message_html.return_value = {
            "id": "msg-1",
            "internalDate": internal_date_ms,
            "html": "<html>fake</html>",
        }
        gmail.add_label.return_value = None

        parsed_txs = [{
            "date": datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc),
            "libelle": "Carte BforBank",
            "compteLinxo": "BforBank Compte Courant",
            "montant": -36.82,
            "categorieLinxo": "Courses",
        }]
        parsed_soldes = [{
            "compte": "BforBank Compte Courant",
            "solde": 1135.19,
            "status": "OK",
        }]
        mocker.patch("main.parse_email_linxo", return_value=(parsed_txs, parsed_soldes))

        import main

    return main, gmail, save_soldes


def test_balance_written_directly_to_account_balances(mocked_main):
    """Le solde parsé est persisté via sauvegarder_soldes_comptes (account_balances)."""
    main, gmail, save_soldes = mocked_main

    result = main._run_linxo_import_core(gmail)

    assert result["transactionsImported"] == 1
    assert result["soldesImported"] == 1

    save_soldes.assert_called_once()
    payloads = save_soldes.call_args.args[0]
    assert len(payloads) == 1
    assert payloads[0]["compte"] == "BforBank"        # mappé vers le nom budget
    assert payloads[0]["solde"] == 1135.19            # solde parsé, écrit tel quel
    assert payloads[0]["status"] == "reconciled"      # enum moderne, pas "UNKNOWN"
    assert save_soldes.call_args.kwargs.get("source") == "gmail"


def test_multiple_soldes_imported(mocked_main, mocker):
    """Plusieurs comptes sont écrits dans account_balances."""
    main, gmail, save_soldes = mocked_main

    parsed_txs = [{
        "date": datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc),
        "libelle": "Virement LCL",
        "compteLinxo": "LCL Compte Joint",
        "montant": 100.0,
        "categorieLinxo": "Virements",
    }]
    parsed_soldes = [
        {"compte": "BforBank Compte Courant", "solde": 1135.19, "status": "OK"},
        {"compte": "LCL Compte Joint", "solde": 5000.00, "status": "OK"},
    ]
    mocker.patch("main.parse_email_linxo", return_value=(parsed_txs, parsed_soldes))
    main.CONFIG["COMPTES_ACTIFS"]["LCL Compte Joint"] = "LCL"

    result = main._run_linxo_import_core(gmail)

    assert result["soldesImported"] == 2
    payloads = save_soldes.call_args.args[0]
    by_account = {p["compte"]: p for p in payloads}
    assert by_account["BforBank"]["solde"] == 1135.19
    assert by_account["LCL"]["solde"] == 5000.00


def test_transactions_scanned_once_for_multiple_soldes(mocked_main, mocker):
    """RÉGRESSION : la collection `transactions` doit être scannée UNE SEULE fois
    par run, même avec plusieurs soldes/comptes à traiter dans la boucle
    `calcul_coherence_solde`, et non une fois par solde."""
    main, gmail, save_soldes = mocked_main

    parsed_txs = [{
        "date": datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc),
        "libelle": "Virement LCL",
        "compteLinxo": "LCL Compte Joint",
        "montant": 100.0,
        "categorieLinxo": "Virements",
    }]
    parsed_soldes = [
        {"compte": "BforBank Compte Courant", "solde": 1135.19, "status": "OK"},
        {"compte": "LCL Compte Joint", "solde": 5000.00, "status": "OK"},
    ]
    mocker.patch("main.parse_email_linxo", return_value=(parsed_txs, parsed_soldes))
    main.CONFIG["COMPTES_ACTIFS"]["LCL Compte Joint"] = "LCL"

    scan_mock = mocker.patch(
        "main.charger_transactions_pour_coherence",
        return_value=[
            {"compte": "BforBank", "montant": -10.0, "date": "2026-05-14", "emailDate": None},
            {"compte": "LCL", "montant": 100.0, "date": "2026-05-15", "emailDate": None},
        ],
    )
    coherence_mock = mocker.patch("main.calcul_coherence_solde", return_value={
        "previousSolde": None, "computedSolde": None, "linxoDelta": None, "ecart": None,
    })

    main._run_linxo_import_core(gmail)

    # Un seul chargement malgré 2 soldes traités, pour les comptes de ces soldes.
    scan_mock.assert_called_once()
    assert sorted(scan_mock.call_args.args[0]) == ["BforBank", "LCL"]

    # Chaque appel de calcul_coherence_solde reçoit sa part pré-filtrée par compte.
    assert coherence_mock.call_count == 2
    for call in coherence_mock.call_args_list:
        assert "tx_all" in call.kwargs


def test_unknown_account_ignored(mocked_main, mocker):
    """Un compte Linxo inconnu ne génère aucune écriture de solde."""
    main, gmail, save_soldes = mocked_main

    mocker.patch("main.parse_email_linxo", return_value=([], [
        {"compte": "UnknownAccount", "solde": 9999.99, "status": "OK"},
    ]))

    result = main._run_linxo_import_core(gmail)

    assert result["soldesImported"] == 0
    save_soldes.assert_not_called()


def test_unauthenticated_message_is_not_parsed_or_persisted(mocked_main, mocker):
    main, gmail, save_soldes = mocked_main
    gmail.is_authenticated_sender.return_value = False
    parser = mocker.patch("main.parse_email_linxo")

    result = main._run_linxo_import_core(gmail)

    assert result["emailsProcessed"] == 0
    parser.assert_not_called()
    save_soldes.assert_not_called()
    gmail.add_label.assert_not_called()


def test_empty_soldes_no_write(mocked_main, mocker):
    """Aucun solde parsé -> aucune écriture."""
    main, gmail, save_soldes = mocked_main

    mocker.patch("main.parse_email_linxo", return_value=([], []))

    result = main._run_linxo_import_core(gmail)

    assert result["soldesImported"] == 0
    save_soldes.assert_not_called()


def test_backlog_is_capped_per_run(mocked_main, mocker):
    """Au-delà de MAX_EMAILS_PER_RUN, le surplus est reporté (emailsRemaining)."""
    main, gmail, _ = mocked_main
    mocker.patch.object(main, "MAX_EMAILS_PER_RUN", 2)

    gmail.search_emails.return_value = [{"id": f"msg-{i}"} for i in range(5)]
    gmail.get_message_html.side_effect = lambda mid: {
        "id": mid, "internalDate": 1_700_000_000_000, "html": "<html>x</html>",
    }
    mocker.patch("main.parse_email_linxo", return_value=([], []))

    result = main._run_linxo_import_core(gmail)

    assert result["emailsScanned"] == 5
    assert result["emailsProcessed"] == 2
    assert result["emailsRemaining"] == 3


def test_oldest_emails_processed_first(mocked_main, mocker):
    """Gmail renvoie du plus récent au plus ancien : on traite l'inverse pour que
    le solde le plus récent soit écrit en dernier au fil des invocations."""
    main, gmail, _ = mocked_main
    mocker.patch.object(main, "MAX_EMAILS_PER_RUN", 2)

    # Ordre Gmail : récent -> ancien
    gmail.search_emails.return_value = [{"id": "recent"}, {"id": "milieu"}, {"id": "ancien"}]
    processed = []
    gmail.get_message_html.side_effect = lambda mid: (
        processed.append(mid)
        or {"id": mid, "internalDate": 1_700_000_000_000, "html": "<html>x</html>"}
    )
    mocker.patch("main.parse_email_linxo", return_value=([], []))

    main._run_linxo_import_core(gmail)

    assert processed == ["ancien", "milieu"]


def test_poll_imports_without_history_cursor(mocked_main, mocker):
    """L'import Linxo manuel déclenche l'import directement, sans dépendre de
    l'API Gmail History (curseur fragile qui se périmait et bloquait
    silencieusement l'import). Régression : `_run_linxo_import_core` (appelé par
    le callable `import_linxo_transactions`) doit importer même quand aucun
    curseur historyId n'est disponible."""
    main, gmail, save_soldes = mocked_main
    mocker.patch.object(main, "_build_gmail_client", return_value=gmail)

    # On exerce directement la logique d'import (comme les autres tests) plutôt
    # que le callable `import_linxo_transactions`, qui n'est qu'une fine
    # enveloppe d'auth @https_fn.on_call nécessitant un contexte Flask.
    main._run_linxo_import_core(gmail)

    # L'import s'est bien déclenché : le solde a été écrit dans account_balances.
    save_soldes.assert_called_once()
