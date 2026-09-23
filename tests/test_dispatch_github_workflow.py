"""
Tests unitaires pour `main._dispatch_github_workflow_logic`.

Vérifie que le jeton GitHub est lu côté serveur (jamais depuis req.data ni
Firestore), que l'accès est réservé au propriétaire, et que la requête vers
l'API GitHub est correctement formée.
"""

from unittest.mock import MagicMock

import pytest
from firebase_functions import https_fn

from src.auth import OWNER_UID


def create_mock_callable_request(auth_uid=None, data=None):
    req = MagicMock(spec=https_fn.CallableRequest)
    if auth_uid:
        mock_auth = MagicMock()
        mock_auth.uid = auth_uid
        req.auth = mock_auth
    else:
        req.auth = None
    req.data = data or {}
    return req


@pytest.fixture
def main_module(functions_import_path):
    """Importe `functions.main` en isolant le sys.path de `functions/src`."""
    with functions_import_path():
        import main

    return main


def test_dispatch_no_auth(main_module):
    req = create_mock_callable_request(auth_uid=None, data={"event_type": "import-linxo"})

    with pytest.raises(https_fn.HttpsError) as exc_info:
        main_module._dispatch_github_workflow_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED


def test_dispatch_wrong_owner(main_module):
    req = create_mock_callable_request(auth_uid="not_the_owner", data={"event_type": "import-linxo"})

    with pytest.raises(https_fn.HttpsError) as exc_info:
        main_module._dispatch_github_workflow_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED


def test_dispatch_missing_event_type(main_module):
    req = create_mock_callable_request(auth_uid=OWNER_UID, data={})

    with pytest.raises(https_fn.HttpsError) as exc_info:
        main_module._dispatch_github_workflow_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT


def test_dispatch_missing_token(main_module, mocker):
    mocker.patch(
        "main.os.environ.get",
        side_effect=lambda k, default=None: None if k == "GITHUB_DISPATCH_TOKEN" else default,
    )

    req = create_mock_callable_request(auth_uid=OWNER_UID, data={"event_type": "import-linxo"})

    with pytest.raises(https_fn.HttpsError) as exc_info:
        main_module._dispatch_github_workflow_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.FAILED_PRECONDITION


def test_dispatch_success(main_module, mocker):
    mocker.patch(
        "main.os.environ.get",
        side_effect=lambda k, default=None: "fake-token" if k == "GITHUB_DISPATCH_TOKEN" else default,
    )
    mock_post = mocker.patch("main.requests.post")
    mock_post.return_value = MagicMock(status_code=204)

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={"event_type": "import-linxo"},
    )

    result = main_module._dispatch_github_workflow_logic(req)

    assert result == {"status": "success"}
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert args[0] == f"https://api.github.com/repos/{main_module.GITHUB_REPO_OWNER}/{main_module.GITHUB_REPO_NAME}/dispatches"
    assert kwargs["headers"]["Authorization"] == "token fake-token"
    assert kwargs["json"] == {"event_type": "import-linxo"}
    assert "client_payload" not in kwargs["json"]


def test_dispatch_with_client_payload(main_module, mocker):
    mocker.patch(
        "main.os.environ.get",
        side_effect=lambda k, default=None: "fake-token" if k == "GITHUB_DISPATCH_TOKEN" else default,
    )
    mock_post = mocker.patch("main.requests.post")
    mock_post.return_value = MagicMock(status_code=204)

    req = create_mock_callable_request(
        auth_uid=OWNER_UID,
        data={"event_type": "import-linxo", "client_payload": {"foo": "bar"}},
    )

    result = main_module._dispatch_github_workflow_logic(req)

    assert result == {"status": "success"}
    _, kwargs = mock_post.call_args
    assert kwargs["json"] == {"event_type": "import-linxo", "client_payload": {"foo": "bar"}}


def test_dispatch_github_http_error(main_module, mocker):
    mocker.patch(
        "main.os.environ.get",
        side_effect=lambda k, default=None: "fake-token" if k == "GITHUB_DISPATCH_TOKEN" else default,
    )
    mock_post = mocker.patch("main.requests.post")
    mock_post.return_value = MagicMock(status_code=401, text="Bad credentials")

    req = create_mock_callable_request(auth_uid=OWNER_UID, data={"event_type": "import-linxo"})

    with pytest.raises(https_fn.HttpsError) as exc_info:
        main_module._dispatch_github_workflow_logic(req)

    assert exc_info.value.code == https_fn.FunctionsErrorCode.INTERNAL
