"""
Tests unitaires pour reconciliation_actions.py
Teste : record_reconciliation_action_logic()
"""

import pytest
from unittest.mock import MagicMock
from firebase_functions import https_fn

from src.auth import OWNER_UID


def create_mock_callable_request(auth_uid=None, data=None):
    """Factory pour créer un mock CallableRequest"""
    req = MagicMock(spec=https_fn.CallableRequest)

    if auth_uid:
        mock_auth = MagicMock()
        mock_auth.uid = auth_uid
        req.auth = mock_auth
    else:
        req.auth = None

    req.data = data or {}
    return req


def test_reconciliation_action_user_choice_success(mocker, mock_firestore_client):
    """Action CHOOSE_SOURCE : utilisateur choisit une source => succès"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    mocker.patch('src.reconciliation_actions._get_db', return_value=mock_firestore_client)
    mocker.patch('src.reconciliation_actions._run_with_backoff',
                 return_value={"status": "success", "newBalance": 5000.00})

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={
            "accountId": "acc_456",
            "eventType": "reconciled_user_choice",
            "chosenValue": 5000.00,
            "chosenSource": "eb_api"
        }
    )

    result = record_reconciliation_action_logic(req)

    assert result["status"] == "success"
    assert result["newBalance"] == 5000.00


def test_reconciliation_action_manual_override_success(mocker, mock_firestore_client):
    """Action MANUAL_OVERRIDE : utilisateur entre une valeur manuelle => succès"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    mocker.patch('src.reconciliation_actions._get_db', return_value=mock_firestore_client)
    mocker.patch('src.reconciliation_actions._run_with_backoff',
                 return_value={"status": "success", "newBalance": 6000.00})

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={
            "accountId": "acc_789",
            "eventType": "reconciled_manual_override",
            "manualValue": 6000.00
        }
    )

    result = record_reconciliation_action_logic(req)

    assert result["status"] == "success"
    assert result["newBalance"] == 6000.00


def test_reconciliation_action_manual_confirm_success(mocker, mock_firestore_client):
    """Action MANUAL_CONFIRM : utilisateur confirme le solde courant => succes"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    mocker.patch('src.reconciliation_actions._get_db', return_value=mock_firestore_client)
    mocker.patch('src.reconciliation_actions._run_with_backoff',
                 return_value={"status": "success", "newBalance": 1378.22})

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={
            "accountId": "acc_confirm",
            "eventType": "reconciled_manual_confirm"
        }
    )

    result = record_reconciliation_action_logic(req)

    assert result["status"] == "success"
    assert result["newBalance"] == 1378.22


def test_reconciliation_action_acknowledge_success(mocker, mock_firestore_client):
    """Action ACKNOWLEDGE : utilisateur reconnaît la discrepancy => succès"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    mocker.patch('src.reconciliation_actions._get_db', return_value=mock_firestore_client)
    mocker.patch('src.reconciliation_actions._run_with_backoff',
                 return_value={"status": "success", "newBalance": 3000.00})

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={
            "accountId": "acc_001",
            "eventType": "discrepancy_acknowledged"
        }
    )

    result = record_reconciliation_action_logic(req)

    assert result["status"] == "success"


def test_reconciliation_action_no_auth():
    """Pas d'authentification => HttpsError UNAUTHENTICATED"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    req = create_mock_callable_request(
        auth_uid=None,
        data={"accountId": "acc_456", "eventType": "reconciled_user_choice"}
    )

    with pytest.raises(https_fn.HttpsError) as exc_info:
        record_reconciliation_action_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED


def test_reconciliation_action_wrong_owner():
    """Authentifié mais UID != propriétaire => HttpsError PERMISSION_DENIED"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    req = create_mock_callable_request(
        auth_uid="not_the_owner",
        data={"accountId": "acc_456", "eventType": "reconciled_user_choice"}
    )

    with pytest.raises(https_fn.HttpsError) as exc_info:
        record_reconciliation_action_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED


def test_reconciliation_action_missing_account_id():
    """Champ accountId manquant => HttpsError INVALID_ARGUMENT"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={"eventType": "reconciled_user_choice"}
    )

    with pytest.raises(https_fn.HttpsError) as exc_info:
        record_reconciliation_action_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT


def test_reconciliation_action_missing_event_type():
    """Champ eventType manquant => HttpsError INVALID_ARGUMENT"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={"accountId": "acc_456"}
    )

    with pytest.raises(https_fn.HttpsError) as exc_info:
        record_reconciliation_action_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT


def _capture_update_payload(mocker, mock_firestore_client, data, existing=None):
    """Exécute réellement la transaction et renvoie le payload passé à update().

    Les autres tests moquent _run_with_backoff et n'exercent donc jamais le
    corps transactionnel. Ici on neutralise le décorateur @firestore.transactional
    (identité) et on déroule _run_with_backoff pour inspecter update_payload.
    """
    import src.reconciliation_actions as ra

    mocker.patch.object(ra, "_get_db", return_value=mock_firestore_client)
    mocker.patch.object(ra, "_run_with_backoff", side_effect=lambda fn, label: fn())
    mocker.patch.object(ra.firestore, "transactional", lambda fn: fn)
    mocker.patch.object(ra.firestore, "SERVER_TIMESTAMP", "SERVER_TS")
    mocker.patch.object(ra.firestore, "DELETE_FIELD", "DELETE")

    snapshot = MagicMock()
    snapshot.exists = True
    snapshot.to_dict.return_value = existing or {"current_balance": 1000.0, "solde": 1000.0}
    account_ref = mock_firestore_client.collection.return_value.document.return_value
    account_ref.get.return_value = snapshot
    transaction = mock_firestore_client.transaction.return_value

    req = create_mock_callable_request(auth_uid=OWNER_UID, data=data)
    ra.record_reconciliation_action_logic(req)

    update_call = transaction.update.call_args
    return update_call.args[1]  # update(account_ref, payload)


def test_manual_override_anchors_email_date(mocker, mock_firestore_client):
    """Un solde forcé manuellement réancre emailDate à l'instant de l'action.

    Régression : sans ce réancrage, calcul_coherence_solde gardait une borne
    temporelle obsolète, ne comptait pas la transaction suivante et flaggait
    le compte "À RÉVISER" (pending_review) à tort.
    """
    payload = _capture_update_payload(
        mocker, mock_firestore_client,
        data={
            "accountId": "BforBank",
            "eventType": "reconciled_manual_override",
            "manualValue": 6000.00,
        },
    )

    assert payload["emailDate"] == "SERVER_TS"
    assert payload["solde"] == 6000.00
    assert payload["status"] == "reconciled"


def test_manual_confirm_anchors_email_date(mocker, mock_firestore_client):
    """Confirmer le solde courant réancre aussi emailDate à maintenant."""
    payload = _capture_update_payload(
        mocker, mock_firestore_client,
        data={"accountId": "LCL", "eventType": "reconciled_manual_confirm"},
    )

    assert payload["emailDate"] == "SERVER_TS"
    assert payload["status"] == "reconciled"


def test_reconciliation_action_with_savings_account(mocker, mock_firestore_client):
    """isSavings=true => action réussit avec savings_balances"""
    from src.reconciliation_actions import record_reconciliation_action_logic

    mocker.patch('src.reconciliation_actions._get_db', return_value=mock_firestore_client)
    mocker.patch('src.reconciliation_actions._run_with_backoff',
                 return_value={"status": "success", "newBalance": 50000.00})

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={
            "accountId": "acc_savings_001",
            "eventType": "reconciled_user_choice",
            "chosenValue": 50000.00,
            "chosenSource": "eb_api",
            "isSavings": True
        }
    )

    result = record_reconciliation_action_logic(req)

    assert result["status"] == "success"
    assert result["newBalance"] == 50000.00
