"""
Fixtures pytest partagées pour tous les tests Cloud Functions
Mocking : Firestore, Request, CloudEvent, Google OIDC token
"""

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
