"""Tests pour la chaîne Gmail Push (`functions/main.py`).

Couvre les deux maillons qui n'avaient aucun test alors qu'ils ont cassé
plusieurs fois : le décodage/aiguillage des notifications Pub/Sub reçues par
`gmail_watch_handler`, et le cycle de vie du watch Gmail (enregistrement,
renouvellement, trace de l'échec).
"""

import base64
import json
import os
import sys
from unittest.mock import MagicMock

import pytest
from flask import Flask
from google.auth.exceptions import TransportError


@pytest.fixture
def watch_main(mocker):
    """Importe `functions.main` avec ses dépendances Firestore/Gmail mockées."""
    src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
    src_removed = False
    if src_path in sys.path:
        sys.path.remove(src_path)
        src_removed = True

    for mod in ("firebase_db", "main", "transaction_parser", "gmail_client"):
        sys.modules.pop(mod, None)

    import main

    if src_removed:
        sys.path.append(src_path)

    gmail = MagicMock()
    mocker.patch.object(main, "_build_gmail_client", return_value=gmail)

    deps = {
        "import_core": mocker.patch.object(main, "_run_linxo_import_core", return_value={}),
        "get_history": mocker.patch.object(main, "get_gmail_history_id", return_value=None),
        "save_history": mocker.patch.object(main, "save_gmail_history_id"),
        "save_status": mocker.patch.object(main, "save_gmail_watch_status"),
    }
    return main, gmail, deps


@pytest.fixture
def watch_main_authed(watch_main, mocker):
    """watch_main, avec l'authentification Pub/Sub (_verify_pubsub_push) déjà
    validée : pour les tests de routage des notifications, qui ne portent pas
    sur l'authentification elle-même (celle-ci a sa suite de tests dédiée)."""
    main, _gmail, _deps = watch_main
    mocker.patch.object(main, "_verify_pubsub_push", return_value=True)
    return watch_main


def _push_request(history_id="4242"):
    """Construit une requête Flask-like reproduisant une push subscription Pub/Sub."""
    payload = json.dumps({"emailAddress": "user@example.com", "historyId": history_id})
    envelope = {
        "message": {
            "data": base64.b64encode(payload.encode("utf-8")).decode("utf-8"),
            "messageId": "1",
        },
        "subscription": "projects/suivi-budget-ab888/subscriptions/gmail-linxo-push-to-cloudrun",
    }
    req = MagicMock()
    req.get_json.return_value = envelope
    return req


# --- gmail_watch_handler ----------------------------------------------------


def test_handler_runs_full_import_without_stored_cursor(watch_main_authed):
    """Sans historyId connu, impossible de differ : on relit toute la boîte."""
    main, _gmail, deps = watch_main_authed
    deps["get_history"].return_value = None

    response = main.gmail_watch_handler(_push_request())

    assert response.status_code == 200
    deps["import_core"].assert_called_once()


def test_handler_imports_when_a_linxo_email_arrived(watch_main_authed):
    """Un message Linxo depuis le dernier curseur déclenche l'import."""
    main, gmail, deps = watch_main_authed
    deps["get_history"].return_value = "4000"
    gmail.get_new_message_ids_from_history.return_value = ["msg-1"]
    gmail.get_message_sender.return_value = "Linxo <assistance@linxo.com>"

    response = main.gmail_watch_handler(_push_request())

    assert response.status_code == 200
    gmail.get_new_message_ids_from_history.assert_called_once_with("4000")
    deps["import_core"].assert_called_once()


def test_handler_only_advances_cursor_when_no_linxo_email(watch_main_authed):
    """Un mail non-Linxo ne doit pas déclencher d'import, mais faire avancer le curseur."""
    main, gmail, deps = watch_main_authed
    deps["get_history"].return_value = "4000"
    gmail.get_new_message_ids_from_history.return_value = ["msg-1"]
    gmail.get_message_sender.return_value = "Facture <no-reply@edf.fr>"

    response = main.gmail_watch_handler(_push_request(history_id="4242"))

    assert response.status_code == 200
    deps["import_core"].assert_not_called()
    deps["save_history"].assert_called_once_with("4242")


def test_handler_falls_back_to_full_import_on_expired_cursor(watch_main_authed):
    """historyId périmé (> 7 jours) : l'API lève, on retombe sur l'import complet."""
    main, gmail, deps = watch_main_authed
    deps["get_history"].return_value = "1"
    gmail.get_new_message_ids_from_history.side_effect = RuntimeError("404 historyId not found")

    response = main.gmail_watch_handler(_push_request())

    assert response.status_code == 200
    deps["import_core"].assert_called_once()


def test_handler_rejects_undecodable_notification(watch_main_authed):
    """Une enveloppe illisible est refusée (400) sans lancer d'import."""
    main, _gmail, deps = watch_main_authed
    req = MagicMock()
    req.get_json.return_value = {"message": {"data": "pas-du-base64-json!!"}}

    response = main.gmail_watch_handler(req)

    assert response.status_code == 400
    deps["import_core"].assert_not_called()


# --- authentification Pub/Sub (_verify_pubsub_push) -------------------------


def _authed_request(token="valid-token"):
    req = MagicMock()
    req.headers = {"Authorization": f"Bearer {token}"}
    return req


def test_handler_rejects_request_without_valid_pubsub_auth(watch_main, mocker):
    """Bout en bout : le handler renvoie 403 et ne traite rien si l'auth échoue."""
    main, _gmail, deps = watch_main
    mocker.patch.object(main, "_verify_pubsub_push", return_value=False)

    req = MagicMock()
    req.headers = {}

    response = main.gmail_watch_handler(req)

    assert response.status_code == 403
    deps["import_core"].assert_not_called()
    req.get_json.assert_not_called()


def test_verify_pubsub_push_fails_closed_without_config(watch_main):
    """Sans GMAIL_PUSH_SERVICE_ACCOUNT/GMAIL_PUSH_AUDIENCE configurés, on refuse tout."""
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = ""
    main.GMAIL_PUSH_AUDIENCE = ""

    assert main._verify_pubsub_push(_authed_request()) is False


def test_verify_pubsub_push_rejects_missing_authorization_header(watch_main):
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"

    req = MagicMock()
    req.headers = {}

    assert main._verify_pubsub_push(req) is False


def test_verify_pubsub_push_rejects_non_bearer_header(watch_main):
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"

    req = MagicMock()
    req.headers = {"Authorization": "Basic dXNlcjpwYXNz"}

    assert main._verify_pubsub_push(req) is False


def test_verify_pubsub_push_rejects_invalid_token(watch_main, mocker):
    """Jeton mal formé/expiré/signature invalide : verify_oauth2_token lève ValueError."""
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"
    mocker.patch.object(main.google_id_token, "verify_oauth2_token", side_effect=ValueError("bad token"))

    assert main._verify_pubsub_push(_authed_request()) is False


def test_verify_pubsub_push_rejects_on_transport_error(watch_main, mocker):
    """RÉGRESSION : verify_oauth2_token récupère les certificats Google par le
    réseau et peut lever autre chose qu'une ValueError (TransportError). Le
    handler doit répondre 403, pas laisser remonter une 500."""
    main, _gmail, deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"
    mocker.patch.object(
        main.google_id_token,
        "verify_oauth2_token",
        side_effect=TransportError("certificats injoignables"),
    )

    assert main._verify_pubsub_push(_authed_request()) is False

    # Et bout en bout : le handler renvoie bien 403 sans rien traiter.
    req = _push_request()
    req.headers = {"Authorization": "Bearer un-jeton"}
    response = main.gmail_watch_handler(req)

    assert response.status_code == 403
    deps["import_core"].assert_not_called()


def test_verify_pubsub_push_rejects_wrong_service_account(watch_main, mocker):
    """Jeton valide mais émis pour un AUTRE compte de service : refusé."""
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"
    mocker.patch.object(
        main.google_id_token,
        "verify_oauth2_token",
        return_value={"email": "attacker@evil.example.com", "email_verified": True},
    )

    assert main._verify_pubsub_push(_authed_request()) is False


def test_verify_pubsub_push_rejects_unverified_email(watch_main, mocker):
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"
    mocker.patch.object(
        main.google_id_token,
        "verify_oauth2_token",
        return_value={"email": "push-sa@example.iam.gserviceaccount.com", "email_verified": False},
    )

    assert main._verify_pubsub_push(_authed_request()) is False


def test_verify_pubsub_push_accepts_valid_token(watch_main, mocker):
    """Cas nominal : jeton signé Google, bonne audience, bon compte de service, e-mail vérifié."""
    main, _gmail, _deps = watch_main
    main.GMAIL_PUSH_SERVICE_ACCOUNT = "push-sa@example.iam.gserviceaccount.com"
    main.GMAIL_PUSH_AUDIENCE = "https://handler.example.run.app"
    verify = mocker.patch.object(
        main.google_id_token,
        "verify_oauth2_token",
        return_value={"email": "push-sa@example.iam.gserviceaccount.com", "email_verified": True},
    )

    assert main._verify_pubsub_push(_authed_request("real-oidc-jwt")) is True
    verify.assert_called_once()
    assert verify.call_args.kwargs["audience"] == "https://handler.example.run.app"


# --- cycle de vie du watch --------------------------------------------------


def test_register_watch_targets_the_oauth_project_topic(watch_main):
    """Gmail refuse tout topic hors du projet de l'app OAuth : le nom doit être exact."""
    main, gmail, _deps = watch_main
    gmail.setup_watch.return_value = {"historyId": "4242", "expiration": "1789000000000"}

    main._register_gmail_watch()

    gmail.setup_watch.assert_called_once_with(
        "projects/suivi-budget-ab888/topics/gmail-linxo-notifications"
    )


def test_register_watch_persists_cursor_and_expiration(watch_main):
    """Le succès persiste le curseur ET l'expiration, et efface l'erreur précédente."""
    main, gmail, deps = watch_main
    gmail.setup_watch.return_value = {"historyId": "4242", "expiration": "1789000000000"}

    state = main._register_gmail_watch()

    assert state == {"historyId": "4242", "expiration": "1789000000000"}
    deps["save_history"].assert_called_once_with("4242")
    deps["save_status"].assert_called_once_with(expiration="1789000000000", error=None)


def test_register_watch_records_failure_before_raising(watch_main):
    """RÉGRESSION : un échec doit laisser une trace en base, pas seulement un log."""
    main, gmail, deps = watch_main
    gmail.setup_watch.side_effect = RuntimeError("User not authorized to perform this action")

    with pytest.raises(RuntimeError):
        main._register_gmail_watch()

    deps["save_status"].assert_called_once_with(
        expiration=None, error="User not authorized to perform this action"
    )
    deps["save_history"].assert_not_called()


def test_renew_watch_is_daily():
    """RÉGRESSION : le watch expire en 7 jours — un renouvellement hebdomadaire
    n'a aucune marge, un seul échec tuant Gmail Push pour une semaine entière."""
    workflow = os.path.join(os.path.dirname(__file__), '..', 'functions', 'main.py')
    with open(workflow, encoding="utf-8") as fh:
        source = fh.read()

    assert 'schedule="0 6 * * *"' in source
    assert 'schedule="0 6 * * 1"' not in source


def test_renew_watch_swallows_errors(watch_main):
    """Le planificateur ne doit pas remonter d'exception (retries inutiles)."""
    main, gmail, deps = watch_main
    gmail.setup_watch.side_effect = RuntimeError("boom")

    # on_schedule enveloppe la fonction dans un handler HTTP Flask : il faut de
    # vrais headers et un contexte applicatif pour construire la réponse.
    request = MagicMock()
    request.headers = {}

    with Flask(__name__).app_context():
        main.renew_gmail_watch(request)

    deps["save_status"].assert_called_once_with(expiration=None, error="boom")
