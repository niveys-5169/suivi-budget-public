from datetime import datetime, timedelta, timezone
from copy import deepcopy
import pytest
from banking_memory import MemoryStore
from bank_pipeline import route_linxo, run_reconciliation, update_balances
from bank_observations import normalize_enable, digest
from bank_reconciliation import confirmation_status

NOW = datetime(2026, 10, 9, 8, tzinfo=timezone.utc)
ACCOUNT = {'stableId': 'stable', 'compte': 'LCL', 'enabled': True, 'currency': 'EUR'}


@pytest.fixture
def store(monkeypatch):
    monkeypatch.setenv('EB_MODE', 'active')
    s = MemoryStore()
    s.put('bank_connections', 'c', {'accounts': [ACCOUNT], 'status': 'active'})
    return s


def raw(reference='r', status='BOOK', **changes):
    return {'entry_reference': reference, 'status': status, 'booking_date': '2026-10-01',
            'transaction_amount': {'amount': '42.00', 'currency': 'EUR'},
            'credit_debit_indicator': 'DBIT', 'remittance_information': ['CAFE PARIS'], **changes}


def linxo(message='m', pending=False, **changes):
    return {'messageId': message, 'compte': 'LCL', 'date': '2026-10-01', 'montant': -42,
            'libelle': 'Café Paris', 'emailDate': NOW, 'enAttente': pending, **changes}


@pytest.mark.parametrize('first', ['eb', 'linxo'])
def test_two_arrival_orders_keep_one_row_and_user_changes(store, first):
    eb = normalize_enable([raw()], ACCOUNT, NOW)[0]
    if first == 'eb':
        store.observe([eb]); run_reconciliation(store, NOW)
    else:
        route_linxo(store, [linxo()])
    row = store.all('transactions')[0]
    store.put('transactions', row['id'], {'categorie': 'Mon choix', 'libelle': 'Corrigé',
        'montant': -40, 'compte': 'JOINT', 'date': '2026-09-30', 'pointe': True, 'moisAffectation': '2026-09'})
    if first == 'eb':
        route_linxo(store, [linxo()])
    else:
        store.observe([eb]); run_reconciliation(store, NOW)
    rows = store.all('transactions')
    assert len(rows) == 1
    assert rows[0]['id'] == row['id']
    assert rows[0]['linxoStatus'] == 'matched'
    assert (rows[0]['libelle'], rows[0]['montant'], rows[0]['compte'], rows[0]['date']) == ('Corrigé', -40, 'JOINT', '2026-09-30')
    assert rows[0]['categorie'] == 'Mon choix' and rows[0]['pointe']


def test_equal_payments_count_twice_but_one_notification_confirms_neither(store):
    store.observe(normalize_enable([raw('a', 'PDNG'), raw('b', 'PDNG')], ACCOUNT, NOW))
    route_linxo(store, [linxo()])
    assert len(store.all('transactions')) == 2
    assert sum(t['montant'] for t in store.all('transactions')) == -84
    assert len(store.get('bank_reports', 'reconciliation')['suggestions']) == 2


def test_stable_reference_transition_and_late_confirmation(store):
    store.observe(normalize_enable([raw(status='PDNG')], ACCOUNT, NOW - timedelta(days=20)))
    run_reconciliation(store, NOW)
    before = store.all('transactions')[0]
    assert before['enAttente'] and before['linxoStatus'] == 'waiting'
    store.observe(normalize_enable([raw()], ACCOUNT, NOW - timedelta(days=8)))
    run_reconciliation(store, NOW)
    assert store.all('transactions')[0]['linxoStatus'] == 'overdue'
    store.observe(normalize_enable([raw()], ACCOUNT, NOW))
    assert store.all('bank_observations')[0]['firstBookedAt'] == NOW - timedelta(days=8)
    route_linxo(store, [linxo(pending=True)])
    after = store.all('transactions')[0]
    assert after['id'] == before['id'] and not after['enAttente'] and after['linxoStatus'] == 'matched'
    assert store.get('bank_reports', 'reconciliation')['missing'] == []


def test_repeated_pending_notices_in_one_batch_preserve_occurrences(store):
    notices = [linxo(message=f'm{i}', pending=True, libelle='SEPA', date=f'2026-10-0{i}') for i in (1, 2, 3)]
    route_linxo(store, notices)
    assert len(store.all('bank_observations')) == 3
    assert len(store.all('transactions')) == 1
    route_linxo(store, [linxo('m4', False, libelle='VIREMENT REEL', date='2026-10-03')])
    assert len(store.all('transactions')) == 1
    assert store.all('transactions')[0]['bankStatus'] == 'booked'


def test_duplicate_occurrences_without_reference_reimport_is_idempotent(store):
    rows = normalize_enable([raw(None), raw(None)], ACCOUNT, NOW)
    assert len({r['id'] for r in rows}) == 2
    store.observe(rows); run_reconciliation(store, NOW)
    store.observe(normalize_enable([raw(None), raw(None)], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert len(store.all('transactions')) == 2


def test_identical_ordinary_payments_from_different_emails_remain_distinct(store):
    route_linxo(store, [linxo('purchase-1')])
    route_linxo(store, [linxo('purchase-2')])
    assert len(store.all('transactions')) == 2
    assert sum(row['montant'] for row in store.all('transactions')) == -84


def test_equal_generic_transfers_on_same_day_preserve_multiplicity(store):
    route_linxo(store, [linxo('transfer-1', True, libelle='SEPA'), linxo('transfer-2', True, libelle='SEPA')])
    assert len(store.all('transactions')) == 2


def test_transition_preserves_manual_link_and_observation_mutations_use_lock(store):
    from bank_lock import banking_write_lock
    from enable_banking_client import BankingError
    pending = normalize_enable([raw(None, 'PDNG')], ACCOUNT, NOW)[0]
    store.observe([pending]); route_linxo(store, [linxo()])
    linked = store.get('bank_observations', pending['id'])['linxoObservationId']
    booked = normalize_enable([raw('booked', 'BOOK')], ACCOUNT, NOW)[0]
    with banking_write_lock(store):
        with pytest.raises(BankingError, match='BANKING_BUSY'):
            store.observe([booked])
    store.observe([booked]); run_reconciliation(store, NOW)
    assert store.get('bank_observations', booked['id'])['linxoObservationId'] == linked
    assert store.get('bank_observations', linked)['enableObservationId'] == booked['id']


def test_cancellation_neutralizes_linked_recurrence_but_retains_approval_trace(store):
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    row = store.all('transactions')[0]
    approval = {'txId': row['id'], 'amount': -42, 'date': '2026-10-01', 'approvedAt': 1}
    store.put('recurrences', 'rent', {'approvedMonths': {'2026-10': approval}})
    store.observe(normalize_enable([raw(status='CNCL')], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    cancelled = store.get('recurrences', 'rent')['approvedMonths']['2026-10']
    assert cancelled['bankCancelled'] and cancelled['txId'] == row['id'] and cancelled['approvedAt'] == 1
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert not store.get('recurrences', 'rent')['approvedMonths']['2026-10']['bankCancelled']


def test_explicit_cancellation_excluded_but_disappearance_is_not_cancellation(store):
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    run_reconciliation(store, NOW)
    assert store.all('transactions')[0]['bankStatus'] == 'booked'
    store.observe(normalize_enable([raw(status='CNCL')], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert store.all('transactions')[0]['bankStatus'] == 'cancelled'


def test_tombstone_suppresses_both_arrival_orders(store):
    route_linxo(store, [linxo()])
    row = store.all('transactions')[0]
    store.remove('transactions', row['id'])
    store.put('deleted_transactions', row['id'], {'deleted': True})
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert store.all('transactions') == []


def test_observation_mode_does_not_publish_financial_rows(store, monkeypatch):
    monkeypatch.setenv('EB_MODE', 'observation')
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert store.all('bank_observations') and store.all('transactions') == []


def test_activation_attaches_observation_to_legacy_row_without_historical_reimport(store, monkeypatch):
    from firebase_db import _transaction_id
    from bank_reconciliation import instant
    monkeypatch.setenv('EB_MODE', 'observation')
    tx = linxo()
    assert route_linxo(store, [tx]) == [tx]
    legacy_id = _transaction_id(tx['compte'], instant(tx['date']), tx['libelle'], tx['montant'])
    store.put('transactions', legacy_id, {**tx, 'categorie': 'Mon choix', 'commentaire': 'Ne pas perdre'})
    monkeypatch.setenv('EB_MODE', 'active')
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    assert len(store.all('transactions')) == 1
    row = store.all('transactions')[0]
    assert row['id'] == legacy_id and row['commentaire'] == 'Ne pas perdre' and row['linxoStatus'] == 'matched'


def test_accountless_legacy_identity_never_attaches_another_bank_payment(store):
    from firebase_db import _legacy_transaction_id
    from bank_reconciliation import instant
    tx = linxo()
    legacy = _legacy_transaction_id(instant(tx['date']), tx['libelle'], tx['montant'])
    store.put('transactions', legacy, {**tx, 'compte': 'BforBank', 'categorie': 'Autre banque'})
    route_linxo(store, [tx])
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    rows = store.all('transactions')
    assert len(rows) == 2 and sum(row['montant'] for row in rows) == -84
    assert store.get('transactions', legacy)['compte'] == 'BforBank'
    assert any(row['compte'] == 'LCL' and row.get('linxoStatus') == 'matched' for row in rows)


def test_rollback_to_linxo_preserves_old_canonical_and_imports_new_payments(store, monkeypatch):
    store.observe(normalize_enable([raw()], ACCOUNT, NOW)); run_reconciliation(store, NOW)
    previous = store.all('transactions')[0]
    monkeypatch.setenv('EB_MODE', 'disabled')
    assert route_linxo(store, [linxo()]) == []
    assert len(store.all('transactions')) == 1
    assert store.all('transactions')[0]['id'] == previous['id']
    route_linxo(store, [linxo('next', False, libelle='AUTRE', montant=-13, date='2026-10-09')])
    assert len(store.all('transactions')) == 2
