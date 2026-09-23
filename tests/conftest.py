"""
Fixtures pytest partagées pour tous les tests Cloud Functions
Mocking : Firestore, Request, CloudEvent, Google OIDC token
"""

import contextlib
import sys
import os
import pytest
from unittest.mock import Mock, MagicMock, patch
from firebase_functions import https_fn
from cloudevents.http import CloudEvent
from google.auth.transport import requests as auth_requests

# Ajouter le répertoire functions au sys.path avant tout import
# IMPORTANT: firestore doit être mocké avant d'importer les modules Cloud Functions
functions_dir = os.path.join(os.path.dirname(__file__), '..', 'functions')
if functions_dir not in sys.path:
    sys.path.insert(0, functions_dir)

# Mock firebase_admin.firestore avant toute autre import
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()


@pytest.fixture
def mock_firestore_client():
    """
    Mock du client Firestore global.
    Retourne un mock configuré pour supporter :
    - collection(name).document(id).set(data)
    - collection(name).query().stream()
    - transaction / batch operations
    """
    mock_db = MagicMock()

    # Configuration pour collection().document().set()
    mock_collection = MagicMock()
    mock_doc = MagicMock()
    mock_collection.document.return_value = mock_doc
    mock_db.collection.return_value = mock_collection

    # Configuration pour query().stream()
    mock_query = MagicMock()
    mock_collection.where.return_value = mock_query
    mock_query.stream.return_value = []

    # Configuration pour transaction
    mock_transaction = MagicMock()
    mock_db.transaction.return_value = mock_transaction

    return mock_db


@pytest.fixture
def mock_request():
    """
    Factory fixture pour créer des mock https_fn.Request.
    Usage:
        req = mock_request(
            method="POST",
            headers={"Authorization": "Bearer token"},
            json={"field": "value"}
        )
    """
    def _create_request(method="POST", headers=None, json=None, data=None):
        req = MagicMock(spec=https_fn.Request)
        req.method = method
        req.headers = headers or {}
        req.get_json = Mock(return_value=json)
        req.data = data
        return req

    return _create_request


@pytest.fixture
def mock_event():
    """
    Factory fixture pour créer des mock CloudEvent.
    Usage:
        event = mock_event(
            type="google.cloud.firestore.document.v1.written",
            source="projects/my-project/databases/(default)/documents/proposed_account_balances/doc-123",
            data={...}
        )
    """
    def _create_event(event_type="google.cloud.firestore.document.v1.written",
                      source="projects/test/databases/(default)/documents/test/doc1",
                      data=None):
        event = MagicMock(spec=CloudEvent)
        event.get_type = Mock(return_value=event_type)
        event.get_source = Mock(return_value=source)
        event["type"] = event_type
        event["source"] = source
        event["data"] = data or {}
        return event

    return _create_event


@pytest.fixture
def mock_id_token_verify():
    """
    Mock pour google.oauth2.id_token.verify_oauth2_token().
    Patch le module au niveau de google.oauth2.id_token.
    """
    with patch('google.oauth2.id_token.verify_oauth2_token') as mock_verify:
        yield mock_verify




@pytest.fixture(autouse=True)
def reset_imports(mocker):
    """
    Reset les imports et les singletons avant chaque test.
    Évite les interférences entre tests.
    """
    # Mock initialize_app pour éviter l'init réelle de Firebase
    mocker.patch('firebase_admin.initialize_app', return_value=None)
    yield


# Modules présents à la fois dans src/ et functions/ : sous le même nom dans
# sys.modules, la version src/ importée par un test précédent masquerait celle
# de functions/ (ex. main.py recevant src/firebase_db.py).
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_SRC_DIR = os.path.join(_REPO_ROOT, 'src')
_FUNCTIONS_DIR = os.path.join(_REPO_ROOT, 'functions')
_SHARED_MODULES = {
    name[:-3]
    for name in set(os.listdir(_SRC_DIR)) & set(os.listdir(_FUNCTIONS_DIR))
    if name.endswith('.py')
} | {'main'}


@pytest.fixture
def functions_import_path():
    """Contexte d'import où `functions/` masque `src/`.

    Retire TOUTES les occurrences de src/ du sys.path (plusieurs tests
    l'insèrent à la collecte) et purge les modules homonymes, puis restaure
    sys.path à la sortie. Les imports faits dans le bloc (y compris via
    mocker.patch("main.x")) résolvent donc vers functions/.
    """
    @contextlib.contextmanager
    def _ctx():
        saved_path = list(sys.path)
        sys.path[:] = [p for p in sys.path if os.path.abspath(p) != _SRC_DIR]
        for mod in _SHARED_MODULES:
            sys.modules.pop(mod, None)
        try:
            yield
        finally:
            sys.path[:] = saved_path

    return _ctx
