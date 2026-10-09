import base64
import json
from unittest.mock import Mock
import pytest
import requests
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from enable_banking_client import EnableBankingClient, BankingError


@pytest.fixture
def client():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    transport = Mock()
    return EnableBankingClient('application', pem, transport), transport, key


def response(value, status=200):
    r = Mock(ok=status < 400, status_code=status)
    r.json.return_value = value
    return r


def test_jwt_signature_and_short_expiry(client):
    c, _, key = client
    header, body, signature = c.token().split('.')
    decode = lambda text: base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))
    assert json.loads(decode(header))['kid'] == 'application'
    claims = json.loads(decode(body))
    assert claims['exp'] - claims['iat'] == 300
    key.public_key().verify(decode(signature), (header + '.' + body).encode(), padding.PKCS1v15(), hashes.SHA256())


def test_pagination_complete_and_network_calls_bounded(client):
    c, transport, _ = client
    transport.request.side_effect = [response({'transactions': [1], 'continuation_key': 'next'}), response({'transactions': [2]})]
    assert c.transactions('account', '2026-10-01') == [1, 2]
    assert transport.request.call_args.kwargs['params']['continuation_key'] == 'next'
    assert transport.request.call_args.kwargs['timeout'] == (5, 30)


def test_interrupted_pagination_returns_no_partial_result(client, monkeypatch):
    c, transport, _ = client
    monkeypatch.setattr('enable_banking_client.time.sleep', lambda _: None)
    transport.request.side_effect = [response({'transactions': [1], 'continuation_key': 'next'}), requests.Timeout(), requests.Timeout(), requests.Timeout()]
    with pytest.raises(BankingError, match='NETWORK_ERROR'):
        c.transactions('a', '2026-10-01')
    assert transport.request.call_count == 4


def test_repeating_continuation_is_rejected(client):
    c, transport, _ = client
    transport.request.return_value = response({'transactions': [], 'continuation_key': 'same'})
    with pytest.raises(BankingError, match='INCOMPLETE_PAGINATION'): c.transactions('a', '2026-10-01')


def test_post_exchange_never_retried_and_error_does_not_leak_response(client):
    c, transport, _ = client
    transport.request.side_effect = requests.Timeout('secret-code')
    with pytest.raises(BankingError) as error: c.create_session('secret-code')
    assert str(error.value) == 'NETWORK_ERROR' and transport.request.call_count == 1
