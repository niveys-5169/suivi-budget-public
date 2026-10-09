from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
import pytest
from banking_memory import MemoryStore
from bank_auth import start_authorization, finish_authorization, save_account_mapping
from bank_observations import digest
from bank_lock import banking_write_lock
from bank_sync import sync_banking
from enable_banking_client import BankingError


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('EB_REDIRECT_URL', 'https://backend.example/eb_auth_callback')
    monkeypatch.setenv('EB_APP_URL', 'https://app.example')
    monkeypatch.setenv('EB_MODE', 'active')
    s, client = MemoryStore(), Mock()
    client.banks.return_value = [{'name': 'LCL', 'country': 'FR', 'maximum_consent_validity': 180 * 86400}]
    client.start_auth.return_value = {'url': 'https://bank.example/auth'}
    client.create_session.return_value = {'session_id': 'private-session',
        'access': {'valid_until': (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()},
        'accounts': [{'uid': 'private-account', 'identification_hash': 'stable', 'currency': 'EUR', 'name': 'Courant'}]}
    client.session.return_value = {'status': 'AUTHORIZED'}
    client.transactions.return_value = []
    client.balances.return_value = []
    return s, client


def authorized(setup):
    s, client = setup
    result = start_authorization(s, client, 'owner', 'LCL')
    state = client.start_auth.call_args.args[1]
    return result['connectionId'], state


def test_callback_single_use_and_idempotent_completed_result(setup):
    s, client = setup
    cid, state = authorized(setup)
    with ThreadPoolExecutor(max_workers=2) as pool:
        def finish():
            try:
                return finish_authorization(s, client, state, 'sensitive-code')
            except BankingError:
                return 'busy'
        values = list(pool.map(lambda _: finish(), range(2)))
    assert cid in values and client.create_session.call_count == 1
    assert finish_authorization(s, client, state, 'sensitive-code') == cid
    public = str(s.get('bank_connections', cid))
    assert 'private-session' not in public and 'private-account' not in public
    assert 'sensitive-code' not in str(s.documents)


def test_expired_state_never_exchanges_code(setup):
    s, client = setup
    _, state = authorized(setup)
    s.put('eb_pending_auth', digest(state), {'expiresAt': datetime.now(timezone.utc) - timedelta(seconds=1)})
    with pytest.raises(BankingError): finish_authorization(s, client, state, 'code')
    client.create_session.assert_not_called()


def test_callback_busy_persistence_reuses_staged_session_without_replaying_code(setup):
    s, client = setup
    cid, state = authorized(setup)
    with banking_write_lock(s):
        with pytest.raises(BankingError, match='BANKING_BUSY'):
            finish_authorization(s, client, state, 'code')
    assert finish_authorization(s, client, state, 'code') == cid
    assert client.create_session.call_count == 1


def test_callback_preserves_mapping_changed_during_exchange(setup):
    s, client = setup
    cid, state = authorized(setup)
    finish_authorization(s, client, state, 'code')
    s.put('account_balances', 'OTHER', {'compte': 'OTHER', 'solde': 100})
    start_authorization(s, client, 'owner', 'LCL', cid)
    state = client.start_auth.call_args.args[1]
    session = client.create_session.return_value
    def exchange(code):
        save_account_mapping(s, 'owner', cid, {'stable': {'compte': 'OTHER', 'enabled': False}})
        return session
    client.create_session.side_effect = exchange
    finish_authorization(s, client, state, 'renewal')
    account = s.get('bank_connections', cid)['accounts'][0]
    assert account['compte'] == 'OTHER' and not account['enabled']


def test_unknown_code_exchange_outcome_never_retries(setup):
    s, client = setup
    _, state = authorized(setup)
    client.create_session.side_effect = BankingError('NETWORK_ERROR', True)
    for _ in range(2):
        with pytest.raises(BankingError): finish_authorization(s, client, state, 'code')
    assert client.create_session.call_count == 1


def test_reconnect_preserves_mapping_using_stable_account_identity(setup):
    s, client = setup
    cid, state = authorized(setup)
    finish_authorization(s, client, state, 'code')
    s.put('account_balances', 'LCL', {'compte': 'LCL', 'solde': 100})
    save_account_mapping(s, 'owner', cid, {'stable': {'compte': 'LCL', 'enabled': True}})
    start_authorization(s, client, 'owner', 'LCL', cid)
    state = client.start_auth.call_args.args[1]
    client.create_session.return_value['accounts'][0]['uid'] = 'renewed-private'
    finish_authorization(s, client, state, 'new-code')
    assert s.get('bank_connections', cid)['accounts'][0]['compte'] == 'LCL'
    assert s.get('eb_sessions', cid)['accounts'][0]['accountUid'] == 'renewed-private'


def test_write_lock_prevents_manual_overlapping_claims(setup):
    s, _ = setup
    with banking_write_lock(s):
        with pytest.raises(BankingError, match='BANKING_BUSY'):
            with banking_write_lock(s): pass
    with banking_write_lock(s): pass


def test_duplicate_mapping_is_rejected(setup):
    s, client = setup
    cid, state = authorized(setup); finish_authorization(s, client, state, 'code')
    s.put('account_balances', 'LCL', {'compte': 'LCL', 'solde': 100})
    s.put('bank_connections', 'other', {'accounts': [{'compte': 'LCL', 'enabled': True}]})
    with pytest.raises(BankingError, match='DUPLICATE_MAPPING'):
        save_account_mapping(s, 'owner', cid, {'stable': {'compte': 'LCL', 'enabled': True}})


def test_one_account_failure_keeps_other_accounts_and_linxo(setup):
    s, client = setup
    cid, state = authorized(setup); finish_authorization(s, client, state, 'code')
    s.put('bank_connections', cid, {'accounts': [
        {'stableId': 'a', 'compte': 'LCL', 'enabled': True}, {'stableId': 'b', 'compte': 'BforBank', 'enabled': True}]})
    s.put('eb_sessions', cid, {'accounts': [{'stableId': 'a', 'accountUid': 'a'}, {'stableId': 'b', 'accountUid': 'b'}]})
    client.transactions.side_effect = [BankingError('INCOMPLETE_PAGINATION'), []]
    linxo = Mock(return_value={'transactionsImported': 0})
    result = sync_banking(s, lambda: client, linxo)
    assert result['status'] == 'partial'
    assert client.transactions.call_count == 2 and linxo.call_count == 1
    assert s.get('bank_connections', cid)['successfulAccounts'] == ['b']


def test_existing_run_is_followed_without_starting_another_import(setup):
    s, client = setup
    s.put('bank_locks', 'sync', {'runId': 'other-run', 'expiresAt': datetime.now(timezone.utc) + timedelta(minutes=2)})
    factory, linxo = Mock(return_value=client), Mock()
    result = sync_banking(s, factory, linxo)
    assert result == {'id': 'other-run', 'status': 'running'}
    factory.assert_not_called(); linxo.assert_not_called()


def test_global_disable_stops_bank_calls_but_imports_linxo_and_exposes_mode(setup, monkeypatch):
    s, client = setup
    cid, state = authorized(setup); finish_authorization(s, client, state, 'code')
    monkeypatch.setenv('EB_MODE', 'disabled')
    factory, linxo = Mock(return_value=client), Mock(return_value={'transactionsImported': 0})
    result = sync_banking(s, factory, linxo)
    assert result['status'] == 'success' and s.get('bank_connections', cid)['mode'] == 'disabled'
    factory.assert_not_called(); linxo.assert_called_once()
