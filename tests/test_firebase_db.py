"""
Tests unitaires pour firebase_db.py
Teste : _run_with_backoff(), _stream_with_backoff()
"""

import pytest
import time
from datetime import datetime, timezone
from unittest.mock import Mock, MagicMock, patch, call
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable, DeadlineExceeded


def test_run_with_backoff_success_first_attempt():
    """Opération succès au premier essai => return immédiat"""
    from firebase_db import _run_with_backoff

    operation = Mock(return_value="success")

    result = _run_with_backoff(operation, "Test_operation")

    assert result == "success"
    assert operation.call_count == 1


def test_run_with_backoff_success_after_retries():
    """Opération échoue 2x, réussit à la 3e => return après retries"""
    from firebase_db import _run_with_backoff

    operation = Mock(side_effect=[
        ServiceUnavailable("Error 1"),
        ServiceUnavailable("Error 2"),
        "success"
    ])

    result = _run_with_backoff(operation, "Test_operation")

    assert result == "success"
    assert operation.call_count == 3


def test_run_with_backoff_max_attempts_exceeded():
    """Opération échoue toujours => RuntimeError après max_attempts"""
    from firebase_db import _run_with_backoff

    operation = Mock(side_effect=ResourceExhausted("Always fails"))

    with pytest.raises(RuntimeError) as exc_info:
        _run_with_backoff(operation, "Test_operation", max_attempts=3)

    assert "échec après 3 tentatives" in str(exc_info.value)
    assert operation.call_count == 3


def test_run_with_backoff_retryable_exceptions():
    """Test que les 3 exceptions retryables sont traitées"""
    from firebase_db import _run_with_backoff

    # Test ResourceExhausted
    operation1 = Mock(side_effect=[ResourceExhausted("Error"), "success"])
    result1 = _run_with_backoff(operation1, "Test_resource_exhausted")
    assert result1 == "success"

    # Test ServiceUnavailable
    operation2 = Mock(side_effect=[ServiceUnavailable("Error"), "success"])
    result2 = _run_with_backoff(operation2, "Test_service_unavailable")
    assert result2 == "success"

    # Test DeadlineExceeded
    operation3 = Mock(side_effect=[DeadlineExceeded("Error"), "success"])
    result3 = _run_with_backoff(operation3, "Test_deadline_exceeded")
    assert result3 == "success"


def test_run_with_backoff_non_retryable_exception():
    """Exception non-retryable => levée immédiatement sans retry"""
    from firebase_db import _run_with_backoff

    operation = Mock(side_effect=ValueError("Non-retryable error"))

    with pytest.raises(ValueError):
        _run_with_backoff(operation, "Test_operation")

    assert operation.call_count == 1


def test_run_with_backoff_exponential_backoff_timing(mocker):
    """Test que le backoff exponentiel augmente les délais"""
    from firebase_db import _run_with_backoff

    mocker.patch('firebase_db.time.sleep')  # Mock time.sleep dans le module firebase_db

    operation = Mock(side_effect=[
        ServiceUnavailable("Error 1"),
        ServiceUnavailable("Error 2"),
        "success"
    ])

    _run_with_backoff(operation, "Test_operation", max_attempts=3)

    # Vérifier que sleep a été appelé 2 fois (après 2 erreurs)
    import firebase_db
    assert firebase_db.time.sleep.call_count == 2


def test_stream_with_backoff_success_first_attempt():
    """Stream succès au premier essai => retourne tous les documents"""
    from firebase_db import _stream_with_backoff

    mock_doc1 = MagicMock()
    mock_doc1.to_dict.return_value = {"id": "doc1"}
    mock_doc2 = MagicMock()
    mock_doc2.to_dict.return_value = {"id": "doc2"}

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_doc1, mock_doc2]

    results = list(_stream_with_backoff(mock_query, "Test_stream"))

    assert len(results) == 2
    assert results[0] == mock_doc1
    assert results[1] == mock_doc2
    assert mock_query.stream.call_count == 1


def test_stream_with_backoff_success_after_retries():
    """Stream échoue 1x, réussit à la 2e => retourne tous les documents après retry"""
    from firebase_db import _stream_with_backoff

    mock_doc1 = MagicMock()
    mock_doc1.to_dict.return_value = {"id": "doc1"}

    mock_query = MagicMock()
    mock_query.stream.side_effect = [
        ServiceUnavailable("Error 1"),
        [mock_doc1]
    ]

    results = list(_stream_with_backoff(mock_query, "Test_stream"))

    assert len(results) == 1
    assert results[0] == mock_doc1
    assert mock_query.stream.call_count == 2


def test_stream_with_backoff_max_attempts_exceeded():
    """Stream échoue toujours => RuntimeError après max_attempts"""
    from firebase_db import _stream_with_backoff

    mock_query = MagicMock()
    mock_query.stream.side_effect = ResourceExhausted("Always fails")

    with pytest.raises(RuntimeError) as exc_info:
        list(_stream_with_backoff(mock_query, "Test_stream", max_attempts=2))

    assert "échec après 2 tentatives" in str(exc_info.value)
    assert mock_query.stream.call_count == 2


def test_stream_with_backoff_custom_timeout():
    """Test que le custom timeout est passé à stream()"""
    from firebase_db import _stream_with_backoff

    mock_doc = MagicMock()
    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_doc]

    list(_stream_with_backoff(mock_query, "Test_stream", timeout_s=60, max_attempts=3))

    # Vérifier que stream() a été appelé avec le timeout
    mock_query.stream.assert_called_with(timeout=60)


def test_get_db_singleton(mocker):
    """Test que _get_db() retourne un singleton"""
    from firebase_db import _get_db
    import firebase_db

    import os
    mocker.patch.dict(os.environ, {"FIREBASE_CREDENTIALS": '{"type": "a", "project_id": "a", "private_key": "a", "client_email": "a"}'})
    mocker.patch('firebase_admin.firestore.client')

    # Reset le singleton
    from firebase_admin import firestore
    firestore.client.reset_mock()
    firebase_db._db = None

    result1 = _get_db()
    result2 = _get_db()

    # Vérifier que le même objet est retourné (singleton)
    assert result1 is result2

    # Vérifier que firestore.client() n'a été appelé qu'une fois
    from firebase_admin import firestore
    assert firestore.client.call_count == 1


def test_sauvegarder_soldes_comptes_syncs_current_balance(mocker):
    """Le pipeline legacy doit garder current_balance et solde alignes."""
    from firebase_db import sauvegarder_soldes_comptes

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_latest_col = MagicMock()
    mock_history_col = MagicMock()
    mock_latest_doc = MagicMock()
    mock_history_doc = MagicMock()

    mock_db.batch.return_value = mock_batch
    mock_db.collection.side_effect = lambda name: {
        "account_balances": mock_latest_col,
        "account_balance_history": mock_history_col,
    }[name]
    mock_latest_col.document.return_value = mock_latest_doc
    mock_history_col.document.return_value = mock_history_doc

    mocker.patch("firebase_db._get_db", return_value=mock_db)
    mocker.patch("firebase_db.charger_account_owners_mapping", return_value={"accounts": {"LCL": "Nicolas"}, "default_owner": "Nicolas"})
    mocker.patch("firebase_db.get_owner_for_account", return_value="Nicolas")
    mocker.patch("firebase_db._run_with_backoff", side_effect=lambda operation, _: operation())

    sauvegarder_soldes_comptes(
        [{
            "compte": "LCL",
            "solde": 1173.11,
            "emailDate": datetime(2026, 5, 13, 12, 0, tzinfo=timezone.utc),
            "status": "OK",
        }],
        source="gmail",
    )

    latest_payload = mock_batch.set.call_args_list[0].args[1]
    assert latest_payload["solde"] == 1173.11
    assert latest_payload["current_balance"] == 1173.11
    assert latest_payload["linxo_solde"] == 1173.11


def test_calcul_coherence_solde_uses_same_day_emaildate_boundary(mocker):
    """Une transaction du meme jour mais importee apres l'ancien releve doit compter."""
    from firebase_db import calcul_coherence_solde

    previous_balance_time = datetime(2026, 5, 13, 8, 0, tzinfo=timezone.utc)
    tx_after_balance_time = datetime(2026, 5, 13, 11, 30, tzinfo=timezone.utc)

    latest_balance_doc = MagicMock()
    latest_balance_doc.exists = True
    latest_balance_doc.to_dict.return_value = {
        "solde": 1249.25,
        "emailDate": previous_balance_time,
    }

    tx_doc = MagicMock()
    tx_doc.to_dict.return_value = {
        "compte": "LCL",
        "montant": -57.99,
        "date": "2026-05-13",
        "emailDate": tx_after_balance_time,
    }

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: {
        "account_balances": MagicMock(document=MagicMock(return_value=MagicMock(get=MagicMock(return_value=latest_balance_doc)))),
    }[name]
    mocker.patch("firebase_db._get_db", return_value=mock_db)
    mocker.patch(
        "firebase_db.charger_transactions_existantes_pour_dedoublonnage",
        return_value=[{
            "date": "2026-05-13",
            "compte": "LCL",
            "montant": -57.99,
            "emailDate": tx_after_balance_time,
        }],
    )

    result = calcul_coherence_solde("LCL", 1191.26, previous_balance_time)

    assert result["previousSolde"] == 1249.25
    assert result["linxoDelta"] == -57.99
    assert result["computedSolde"] == pytest.approx(1191.26)
    assert result["ecart"] == 0.0


def _coherence_solde_tx_all_setup(mocker, module):
    """Contexte commun pour vérifier que `tx_all` court-circuite le scan interne."""
    previous_balance_time = datetime(2026, 5, 13, 8, 0, tzinfo=timezone.utc)
    tx_after_balance_time = datetime(2026, 5, 13, 11, 30, tzinfo=timezone.utc)

    latest_balance_doc = MagicMock()
    latest_balance_doc.exists = True
    latest_balance_doc.to_dict.return_value = {
        "solde": 1249.25,
        "emailDate": previous_balance_time,
    }

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: {
        "account_balances": MagicMock(
            document=MagicMock(return_value=MagicMock(get=MagicMock(return_value=latest_balance_doc)))
        ),
    }[name]
    mocker.patch.object(module, "_get_db", return_value=mock_db)
    scan_mock = mocker.patch.object(
        module,
        "charger_transactions_existantes_pour_dedoublonnage",
        return_value=[{
            "date": "2026-05-13",
            "compte": "LCL",
            "montant": -57.99,
            "emailDate": tx_after_balance_time,
        }],
        create=True,
    )
    tx_all = [{
        "date": "2026-05-13",
        "compte": "LCL",
        "montant": -57.99,
        "emailDate": tx_after_balance_time,
    }]
    return previous_balance_time, tx_all, scan_mock


def test_calcul_coherence_solde_tx_all_skips_internal_scan(mocker):
    """Quand `tx_all` est fourni, le scan interne ne doit pas être appelé, et le
    résultat doit être identique à celui du chemin non-hoisté (même données)."""
    import firebase_db

    previous_balance_time, tx_all, scan_mock = _coherence_solde_tx_all_setup(mocker, firebase_db)

    result_hoisted = firebase_db.calcul_coherence_solde("LCL", 1191.26, previous_balance_time, tx_all=tx_all)
    scan_mock.assert_not_called()

    result_internal = firebase_db.calcul_coherence_solde("LCL", 1191.26, previous_balance_time)
    scan_mock.assert_called_once()

    assert result_hoisted == result_internal


def test_src_calcul_coherence_solde_tx_all_skips_internal_scan(mocker):
    """Miroir pour la copie src/ (pipeline GitHub Action)."""
    src_firebase_db = _load_src_firebase_db()

    previous_balance_time, tx_all, scan_mock = _coherence_solde_tx_all_setup(mocker, src_firebase_db)

    result_hoisted = src_firebase_db.calcul_coherence_solde("LCL", 1191.26, previous_balance_time, tx_all=tx_all)
    scan_mock.assert_not_called()

    result_internal = src_firebase_db.calcul_coherence_solde("LCL", 1191.26, previous_balance_time)
    scan_mock.assert_called_once()

    assert result_hoisted == result_internal


def _two_same_day_mails_setup(mocker, module):
    """Contexte commun : un solde précédent daté + deux transactions du même jour
    issues de deux mails Linxo distincts (A à 09:00, B à 15:00). Patche le module
    fourni (copie functions/ ou src/) via patch.object."""
    previous_balance_time = datetime(2026, 5, 13, 8, 0, tzinfo=timezone.utc)
    mail_a_time = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
    mail_b_time = datetime(2026, 5, 13, 15, 0, tzinfo=timezone.utc)

    latest_balance_doc = MagicMock()
    latest_balance_doc.exists = True
    latest_balance_doc.to_dict.return_value = {
        "solde": 1000.0,
        "emailDate": previous_balance_time,
    }

    mock_db = MagicMock()
    mock_db.collection.side_effect = lambda name: {
        "account_balances": MagicMock(
            document=MagicMock(return_value=MagicMock(get=MagicMock(return_value=latest_balance_doc)))
        ),
    }[name]
    mocker.patch.object(module, "_get_db", return_value=mock_db)
    mocker.patch.object(
        module,
        "charger_transactions_existantes_pour_dedoublonnage",
        return_value=[
            {"date": "2026-05-13", "compte": "LCL", "montant": -20.0, "emailDate": mail_a_time},
            {"date": "2026-05-13", "compte": "LCL", "montant": -30.0, "emailDate": mail_b_time},
        ],
        create=True,
    )
    return previous_balance_time, mail_a_time, mail_b_time


def test_calcul_coherence_solde_borne_superieure_exclut_mail_posterieur(mocker):
    """Deux mails Linxo le même jour : valider le solde du mail A (09:00) ne doit
    compter QUE la transaction du mail A, pas celle du mail B (15:00). Sans borne
    supérieure, la transaction de B est additionnée à tort -> faux pending_review."""
    import firebase_db

    _, mail_a_time, _ = _two_same_day_mails_setup(mocker, firebase_db)

    # Solde du mail A = 1000 - 20 = 980. Borne haute = emailDate du mail A.
    result = firebase_db.calcul_coherence_solde(
        "LCL", 980.0, mail_a_time, upper_email_date=mail_a_time
    )

    assert result["previousSolde"] == 1000.0
    assert result["linxoDelta"] == -20.0, "La transaction du mail B (15:00) doit être exclue"
    assert result["computedSolde"] == pytest.approx(980.0)
    assert result["ecart"] == 0.0


def test_src_calcul_coherence_solde_borne_superieure_exclut_mail_posterieur(mocker):
    """Même garde-fou pour la copie src/ utilisée par l'import GitHub Actions."""
    src_firebase_db = _load_src_firebase_db()

    _, mail_a_time, _ = _two_same_day_mails_setup(mocker, src_firebase_db)

    result = src_firebase_db.calcul_coherence_solde(
        "LCL", 980.0, mail_a_time, upper_email_date=mail_a_time
    )

    assert result["linxoDelta"] == -20.0, "La transaction du mail B (15:00) doit être exclue"
    assert result["ecart"] == 0.0


def _load_src_firebase_db():
    """Charge explicitement src/firebase_db.py (et non functions/firebase_db.py).

    conftest.py force `functions/` en tête de sys.path, donc `import firebase_db`
    résout toujours la version Cloud Functions. Pour couvrir le pipeline
    GitHub Action (`src/importer.py`), on importe le module par chemin direct.
    """
    import importlib.util
    import os
    src_path = os.path.join(os.path.dirname(__file__), "..", "src", "firebase_db.py")
    spec = importlib.util.spec_from_file_location("src_firebase_db", src_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_src_charger_transactions_dedoublonnage_includes_emaildate_projection(mocker):
    """Régression : le `.select()` doit inclure `emailDate`, sinon
    `calcul_coherence_solde` perd la précision sub-jour et exclut les
    transactions importées le même jour que l'ancien solde."""
    src_firebase_db = _load_src_firebase_db()

    tx_email_date = datetime(2026, 5, 13, 11, 30, tzinfo=timezone.utc)
    tx_doc = MagicMock()
    tx_doc.to_dict.return_value = {
        "date": "2026-05-13",
        "libelle": "CB AMAZON",
        "montant": -57.99,
        "compte": "LCL",
        "emailDate": tx_email_date,
    }

    select_query = MagicMock()
    select_query.where.return_value = select_query

    transactions_col = MagicMock()
    transactions_col.select.return_value = select_query

    mock_db = MagicMock()
    mock_db.collection.return_value = transactions_col

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(
        src_firebase_db,
        "_stream_with_backoff",
        return_value=[tx_doc],
    )

    out = src_firebase_db.charger_transactions_existantes_pour_dedoublonnage(since_days=0)

    transactions_col.select.assert_called_once()
    selected_fields = transactions_col.select.call_args[0][0]
    assert "emailDate" in selected_fields, (
        "emailDate doit être inclus dans la projection .select() pour que "
        "calcul_coherence_solde puisse comparer les datetimes sub-jour."
    )

    assert len(out) == 1
    assert out[0]["emailDate"] == tx_email_date


def test_functions_charger_transactions_dedoublonnage_includes_emaildate(mocker):
    """Régression : functions/firebase_db.py sélectionnait emailDate depuis
    Firestore mais ne l'incluait pas dans le dict renvoyé.
    filter_window_transactions exclut toute transaction sans emailDate,
    ce qui rendait linxoDelta=0 et faussait l'écart de cohérence."""
    from firebase_db import charger_transactions_existantes_pour_dedoublonnage, _get_db, _stream_with_backoff

    tx_email_date = datetime(2026, 9, 4, 14, 0, tzinfo=timezone.utc)
    tx_doc = MagicMock()
    tx_doc.id = "lcl_2026-09-04_virement_10000"
    tx_doc.to_dict.return_value = {
        "date": "2026-09-04",
        "libelle": "VIREMENT",
        "montant": 100.0,
        "compte": "LCL",
        "emailDate": tx_email_date,
        "enAttente": False,
    }

    select_query = MagicMock()
    select_query.where.return_value = select_query
    transactions_col = MagicMock()
    transactions_col.select.return_value = select_query
    mock_db = MagicMock()
    mock_db.collection.return_value = transactions_col

    mocker.patch("firebase_db._get_db", return_value=mock_db)
    mocker.patch("firebase_db._stream_with_backoff", return_value=[tx_doc])

    out = charger_transactions_existantes_pour_dedoublonnage(since_days=0)

    assert len(out) == 1
    assert "emailDate" in out[0], (
        "emailDate manquant du dict renvoyé par functions/firebase_db.py — "
        "filter_window_transactions exclura toutes les transactions"
    )
    assert out[0]["emailDate"] == tx_email_date


def test_src_charger_transactions_categorisees_filters_and_projects(mocker):
    """Le corpus RAG ne renvoie QUE des transactions catégorisées (la catégorie
    fait partie de la projection .select), en écartant les libellés vides et les
    catégories sentinelles ('A Catégoriser', '', …)."""
    src_firebase_db = _load_src_firebase_db()

    def _doc(d):
        m = MagicMock()
        m.to_dict.return_value = d
        return m

    docs = [
        _doc({"date": "2026-05-01", "libelle": "CARREFOUR", "montant": -42.0,
              "compte": "LCL", "categorie": "Courses"}),
        _doc({"date": "2026-05-02", "libelle": "MYSTERE", "montant": -10.0,
              "compte": "LCL", "categorie": "A Catégoriser"}),   # sentinelle → exclu
        _doc({"date": "2026-05-03", "libelle": "VIDE", "montant": -5.0,
              "compte": "LCL", "categorie": ""}),                 # vide → exclu
        _doc({"date": "2026-05-04", "libelle": "", "montant": -7.0,
              "compte": "LCL", "categorie": "Loisirs"}),          # libellé vide → exclu
    ]

    select_query = MagicMock()
    select_query.where.return_value = select_query
    transactions_col = MagicMock()
    transactions_col.select.return_value = select_query
    mock_db = MagicMock()
    mock_db.collection.return_value = transactions_col

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "_stream_with_backoff", return_value=docs)

    out = src_firebase_db.charger_transactions_categorisees(since_days=0)

    selected_fields = transactions_col.select.call_args[0][0]
    assert "categorie" in selected_fields
    assert len(out) == 1
    assert out[0]["libelle"] == "CARREFOUR"
    assert out[0]["categorie"] == "Courses"


def test_sauvegarder_transactions_deux_virements_identiques(mocker):
    """Deux virements identiques (même date+libelle+montant) dans le même batch
    doivent générer deux documents distincts en Firestore (bug: le 2e écrasait le 1er)."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    tx = {
        "date": datetime(2026, 5, 28),
        "libelle": "Virement",
        "compte": "BforBank",
        "montant": 100.0,
        "categorie": "",
        "emailDate": datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc),
    }
    src_firebase_db.sauvegarder_transactions([tx, dict(tx)], source="gmail")

    doc_ids = [call.args[0] for call in mock_col.document.call_args_list]
    base_id = src_firebase_db._transaction_id(tx["compte"], tx["date"], tx["libelle"], tx["montant"])
    assert base_id in doc_ids, "Le 1er virement doit utiliser l'ID de base"
    assert f"{base_id}_2" in doc_ids, "Le 2e virement identique doit recevoir le suffixe _2"


def test_functions_sauvegarder_transactions_deux_virements_identiques(mocker):
    """Miroir pour la copie functions/ (déployée en Cloud Function) : deux
    transactions distinctes qui collisionnent sur l'ID déterministe (même
    compte/date/montant, libellés identiques sur les 40 premiers caractères
    mais différents ensuite) doivent générer deux documents, pas un seul."""
    import firebase_db

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()
    mock_db.get_all.return_value = []

    mocker.patch.object(firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    libelle_commun = "X" * 40  # tronqué à 40 caractères par _transaction_id
    tx1 = {
        "date": datetime(2026, 5, 28),
        "libelle": libelle_commun + " (virement A)",
        "compte": "BforBank",
        "montant": 100.0,
        "categorie": "",
        "emailDate": datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc),
    }
    tx2 = {**tx1, "libelle": libelle_commun + " (virement B)"}

    saved = firebase_db.sauvegarder_transactions([tx1, tx2], source="gmail")

    assert saved == 2
    doc_ids = [call.args[0] for call in mock_col.document.call_args_list]
    base_id = firebase_db._transaction_id(tx1["compte"], tx1["date"], tx1["libelle"], tx1["montant"])
    assert base_id in doc_ids, "La 1ère transaction doit utiliser l'ID de base"
    assert f"{base_id}_2" in doc_ids, "La 2e transaction collisionnant doit recevoir le suffixe _2"

    set_calls = mock_batch.set.call_args_list
    assert len(set_calls) == 2, "Les deux transactions doivent générer deux écritures distinctes"


def test_transaction_id_distingue_les_comptes():
    """RÉGRESSION : même date/libellé/montant sur deux comptes distincts doit
    produire deux IDs différents — sinon un doc écrase l'autre (batch merge)."""
    src_firebase_db = _load_src_firebase_db()
    args = (datetime(2026, 7, 27), "Retrait", -20.0)
    id_bfor = src_firebase_db._transaction_id("BforBank", *args)
    id_lcl = src_firebase_db._transaction_id("LCL", *args)
    assert id_bfor != id_lcl


def test_tronity_transaction_id_uses_session_id():
    """L'ID de document Tronity est basé sur l'ID session API, pas sur le montant."""
    src_firebase_db = _load_src_firebase_db()
    id1 = src_firebase_db._tronity_transaction_id("session-abc-123", "Voiture")
    id2 = src_firebase_db._tronity_transaction_id("session-abc-123", "Voiture")
    assert id1 == id2, "Même session → même ID"
    assert id1.startswith("tronity_")

    id_other_session = src_firebase_db._tronity_transaction_id("session-xyz-456", "Voiture")
    assert id1 != id_other_session, "Sessions différentes → IDs différents"


def test_resoudre_id_transaction_tronity_uses_session_id():
    """Une transaction Tronity avec tronity_session_id doit utiliser l'ID session."""
    src_firebase_db = _load_src_firebase_db()
    tx = {
        "date": datetime(2026, 4, 6),
        "libelle": "Recharge domicile EV",
        "compte": "Voiture",
        "montant": -3.47,
        "tronity_session_id": "session-abc-123",
    }
    doc_id = src_firebase_db._resoudre_id_transaction(tx, prefetch_map={})
    expected = src_firebase_db._tronity_transaction_id("session-abc-123", "Voiture")
    assert doc_id == expected


def test_resoudre_id_transaction_tronity_idempotent_when_tarif_changes():
    """Même session Tronity, montant différent (tarif changé) → même ID de document."""
    src_firebase_db = _load_src_firebase_db()
    base = {
        "date": datetime(2026, 4, 6),
        "libelle": "Recharge domicile EV",
        "compte": "Voiture",
        "tronity_session_id": "session-abc-123",
    }
    tx_old = dict(base, montant=-3.47)
    tx_new = dict(base, montant=-3.61)  # tarif différent
    id_old = src_firebase_db._resoudre_id_transaction(tx_old, prefetch_map={})
    id_new = src_firebase_db._resoudre_id_transaction(tx_new, prefetch_map={})
    assert id_old == id_new, "Même session = même document, peu importe le tarif"


def test_sauvegarder_transactions_meme_session_tronity_un_seul_document(mocker):
    """RÉGRESSION : quand l'API Tronity répète la même session dans le lot
    (pagination qui reboucle), la recharge ne doit produire qu'UN document —
    et non un exemplaire par répétition sous les IDs suffixés _2, _3, … _200."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()
    mock_db.get_all.return_value = []

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    tx = {
        "date": datetime(2026, 9, 6),
        "libelle": "Recharge domicile EV",
        "compte": "Voiture",
        "montant": -3.47,
        "categorie": "Recharge domicile",
        "tronity_session_id": "session-abc-123",
    }
    saved = src_firebase_db.sauvegarder_transactions([dict(tx) for _ in range(200)], source="tronity")

    assert saved == 1
    assert len(mock_batch.set.call_args_list) == 1, "Une seule écriture pour une seule recharge"
    # (les appels document() incluent aussi le pré-chargement des IDs candidats)
    doc_ids = [call.args[0] for call in mock_col.document.call_args_list]
    expected = src_firebase_db._tronity_transaction_id(tx["tronity_session_id"], tx["compte"])
    assert expected in doc_ids
    assert not [d for d in doc_ids if d.startswith(f"{expected}_")], "Aucun ID suffixé _2, _3, …"


def test_sauvegarder_transactions_sessions_tronity_distinctes_deux_documents(mocker):
    """Deux sessions Tronity différentes le même jour restent deux documents."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()
    mock_db.get_all.return_value = []

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    tx1 = {
        "date": datetime(2026, 9, 6),
        "libelle": "Recharge domicile EV",
        "compte": "Voiture",
        "montant": -3.47,
        "categorie": "Recharge domicile",
        "tronity_session_id": "session-abc-123",
    }
    tx2 = {**tx1, "tronity_session_id": "session-def-456"}

    saved = src_firebase_db.sauvegarder_transactions([tx1, tx2], source="tronity")

    assert saved == 2
    assert len(mock_batch.set.call_args_list) == 2
    doc_ids = [call.args[0] for call in mock_col.document.call_args_list]
    for tx in (tx1, tx2):
        assert src_firebase_db._tronity_transaction_id(
            tx["tronity_session_id"], tx["compte"]
        ) in doc_ids


def test_sauvegarder_transactions_honore_tombstone_format_herite(mocker):
    """Une transaction supprimée AVANT l'ajout du compte a un tombstone au
    format hérité (sans compte). Elle doit rester ignorée après le changement
    de schéma d'ID."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()

    tx = {
        "date": datetime(2026, 5, 28),
        "libelle": "Virement",
        "compte": "BforBank",
        "montant": 100.0,
        "categorie": "",
    }
    legacy_id = src_firebase_db._legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"])

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value={legacy_id})
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    saved = src_firebase_db.sauvegarder_transactions([tx], source="gmail")
    assert saved == 0
    mock_batch.set.assert_not_called()


def test_sauvegarder_transactions_honore_tombstone_tronity(mocker):
    """Une recharge Tronity supprimée depuis le dashboard ne doit pas être
    réintégrée par l'import automatique suivant : le tombstone est enregistré
    sous l'ID déterministe basé sur tronity_session_id, la sauvegarde doit
    donc vérifier ce format d'ID (pas seulement les formats compte/legacy)."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.return_value = MagicMock()

    tx = {
        "date": datetime(2026, 5, 28),
        "libelle": "Recharge domicile EV",
        "compte": "Voiture",
        "montant": -3.47,
        "categorie": "Recharge domicile",
        "tronity_session_id": "session-abc-123",
    }
    tronity_id = src_firebase_db._tronity_transaction_id(
        tx["tronity_session_id"], tx["compte"]
    )

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(
        src_firebase_db, "charger_ids_transactions_supprimees", return_value={tronity_id}
    )
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    saved = src_firebase_db.sauvegarder_transactions([tx], source="tronity")
    assert saved == 0
    mock_batch.set.assert_not_called()


def _mock_db_avec_docs(mocker, src_firebase_db, docs_existants):
    """Prépare un Firestore mocké dont get_all() renvoie `docs_existants`
    ({doc_id: data}). Retourne (mock_batch, mock_col)."""
    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col
    mock_col.document.side_effect = lambda doc_id: MagicMock(_id=doc_id)

    def _get_all(refs):
        snaps = []
        for ref in refs:
            snap = MagicMock()
            snap.id = ref._id
            snap.exists = ref._id in docs_existants
            snap.to_dict.return_value = docs_existants.get(ref._id, {})
            snaps.append(snap)
        return snaps

    mock_db.get_all.side_effect = _get_all
    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())
    return mock_batch, mock_col


def test_reimport_reutilise_lid_herite_et_preserve_le_pointage(mocker):
    """RÉGRESSION INCIDENT 28/07 : réimporter une transaction déjà en base sous
    l'ID hérité doit RÉUTILISER cet ID (donc fusionner) et préserver `pointe`.

    Le bug : l'ID préfixé-compte ne résolvait pas le doc existant, l'import
    écrivait un SECOND document avec pointe=False -> ~286 doublons non pointés."""
    src_firebase_db = _load_src_firebase_db()

    tx = {
        "date": datetime(2026, 3, 15),
        "libelle": "Carrefour",
        "compte": "BforBank",
        "montant": -42.0,
        "categorie": "Alimentation",
    }
    legacy_id = src_firebase_db._legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"])
    nouveau_id = src_firebase_db._transaction_id(
        tx["compte"], tx["date"], tx["libelle"], tx["montant"]
    )
    existant = {"compte": "BforBank", "pointe": True, "categorie": "Courses", "libelle": "Carrefour"}

    mock_batch, mock_col = _mock_db_avec_docs(mocker, src_firebase_db, {legacy_id: existant})
    src_firebase_db.sauvegarder_transactions([tx], source="gmail")

    written_ids = [c.args[0]._id for c in mock_batch.set.call_args_list]
    assert written_ids == [legacy_id], "doit écrire sur l'ID hérité, pas en créer un second"
    assert nouveau_id not in written_ids

    data = mock_batch.set.call_args.args[1]
    assert data["pointe"] is True, "le pointage utilisateur doit être préservé"
    assert data["categorie"] == "Courses", "la catégorie utilisateur doit être préservée"


def test_reimport_collision_inter_comptes_utilise_lid_prefixe(mocker):
    """Un doc hérité existe mais sur un AUTRE compte : c'est la collision que le
    préfixe corrige — on doit écrire sur l'ID préfixé, sans écraser l'autre."""
    src_firebase_db = _load_src_firebase_db()

    tx = {
        "date": datetime(2026, 3, 15),
        "libelle": "Retrait",
        "compte": "LCL",
        "montant": -20.0,
        "categorie": "",
    }
    legacy_id = src_firebase_db._legacy_transaction_id(tx["date"], tx["libelle"], tx["montant"])
    nouveau_id = src_firebase_db._transaction_id(
        tx["compte"], tx["date"], tx["libelle"], tx["montant"]
    )

    mock_batch, _ = _mock_db_avec_docs(
        mocker, src_firebase_db, {legacy_id: {"compte": "BforBank", "pointe": True}}
    )
    src_firebase_db.sauvegarder_transactions([tx], source="gmail")

    written_ids = [c.args[0]._id for c in mock_batch.set.call_args_list]
    assert written_ids == [nouveau_id]
    assert legacy_id not in written_ids, "ne doit pas écraser la transaction de l'autre compte"


def test_transaction_reellement_nouvelle_utilise_lid_prefixe(mocker):
    """Aucun doc hérité : l'ID préfixé-compte est utilisé (comportement cible)."""
    src_firebase_db = _load_src_firebase_db()

    tx = {
        "date": datetime(2026, 7, 27),
        "libelle": "ASSURANCE LCL",
        "compte": "LCL",
        "montant": -11.90,
        "categorie": "",
    }
    nouveau_id = src_firebase_db._transaction_id(
        tx["compte"], tx["date"], tx["libelle"], tx["montant"]
    )

    mock_batch, _ = _mock_db_avec_docs(mocker, src_firebase_db, {})
    src_firebase_db.sauvegarder_transactions([tx], source="gmail")

    written_ids = [c.args[0]._id for c in mock_batch.set.call_args_list]
    assert written_ids == [nouveau_id]


def test_sauvegarder_transactions_deux_virements_identiques_deux_docs_distincts(mocker):
    """Vérifie que batch.set() est appelé 2 fois avec 2 doc_refs différentes."""
    src_firebase_db = _load_src_firebase_db()

    mock_db = MagicMock()
    mock_batch = MagicMock()
    mock_col = MagicMock()
    mock_db.batch.return_value = mock_batch
    mock_db.collection.return_value = mock_col

    created_docs = []
    def make_doc(doc_id):
        d = MagicMock()
        d._id = doc_id
        created_docs.append(d)
        return d
    mock_col.document.side_effect = make_doc

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(src_firebase_db, "charger_ids_transactions_supprimees", return_value=set())
    mocker.patch.object(src_firebase_db, "_run_with_backoff", side_effect=lambda op, *a, **kw: op())

    tx = {
        "date": datetime(2026, 5, 28),
        "libelle": "Virement",
        "compte": "BforBank",
        "montant": 100.0,
        "categorie": "",
        "emailDate": datetime(2026, 5, 28, 10, 0, tzinfo=timezone.utc),
    }
    src_firebase_db.sauvegarder_transactions([tx, dict(tx)], source="gmail")

    set_calls = mock_batch.set.call_args_list
    # 2 transactions + 0 pre-fetch (gmail source needs get_all but we mock _run_with_backoff)
    batch_set_docs = [c.args[0] for c in set_calls]
    assert len(set(id(d) for d in batch_set_docs)) >= 2, (
        "batch.set() doit être appelé avec 2 doc_refs distincts"
    )


def test_src_calcul_coherence_solde_counts_same_day_transaction(mocker):
    """Miroir de `test_calcul_coherence_solde_uses_same_day_emaildate_boundary`
    mais pour `src/firebase_db.py` (pipeline GitHub Action / Synchroniser).

    Reproduit le scénario du bug : ancien solde et nouvelle transaction le
    même jour. Sans `emailDate` dans la projection, la transaction est
    exclue par le fallback chaîne (`"2026-05-13" > "2026-05-13"` = False)
    et `linxoDelta` retombe à 0."""
    src_firebase_db = _load_src_firebase_db()

    previous_balance_time = datetime(2026, 5, 13, 8, 0, tzinfo=timezone.utc)
    tx_after_balance_time = datetime(2026, 5, 13, 11, 30, tzinfo=timezone.utc)

    latest_balance_doc = MagicMock()
    latest_balance_doc.exists = True
    latest_balance_doc.to_dict.return_value = {
        "solde": 1249.25,
        "emailDate": previous_balance_time,
    }

    mock_db = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = latest_balance_doc

    mocker.patch.object(src_firebase_db, "_get_db", return_value=mock_db)
    mocker.patch.object(
        src_firebase_db,
        "charger_transactions_existantes_pour_dedoublonnage",
        return_value=[{
            "date": "2026-05-13",
            "libelle": "CB AMAZON",
            "montant": -57.99,
            "compte": "LCL",
            "emailDate": tx_after_balance_time,
        }],
    )

    result = src_firebase_db.calcul_coherence_solde("LCL", 1191.26, previous_balance_time)

    assert result["previousSolde"] == 1249.25
    assert result["linxoDelta"] == -57.99
    assert result["computedSolde"] == pytest.approx(1191.26)
    assert result["ecart"] == 0.0
