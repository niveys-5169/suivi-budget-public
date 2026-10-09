from datetime import datetime, timedelta, timezone
from banking_memory import MemoryStore
from bank_balances import choose_enable_balance, compare_balances, select_balance
from bank_observations import digest
from bank_pipeline import capture_linxo_balance, update_balances

NOW = datetime(2026, 10, 9, 8, tzinfo=timezone.utc)


def balance(source, **changes):
    return {'compte': 'LCL', 'source': source, 'solde': 100, 'currency': 'EUR', 'balanceType': 'ITBD',
            'bankDate': '2026-10-09', 'receivedAt': NOW, **changes}


def test_booked_balance_priority_over_available():
    values = [{'balance_type': type} for type in ('ITAV', 'CLBD', 'ITBD')]
    assert choose_enable_balance(values)['balance_type'] == 'ITBD'
    assert choose_enable_balance(values[:2])['balance_type'] == 'CLBD'


def test_compatible_balances_and_one_cent_tolerance():
    assert compare_balances(balance('enable_banking'), balance('gmail', solde=100.01), [])['status'] == 'concordant'
    assert compare_balances(balance('enable_banking'), balance('gmail', solde=100.02), [])['status'] == 'discrepancy'


def test_same_values_with_unknown_email_bank_date_remain_unverified():
    control = compare_balances(balance('enable_banking'), balance('gmail', bankDate=None, balanceType='unknown'), [])
    assert control['status'] == 'waiting' and control['difference'] == 0


def test_date_shift_explained_by_one_booked_movement_not_pending():
    movement = {'id': 'o', 'source': 'enable_banking', 'compte': 'LCL', 'bankStatus': 'booked',
                'montant': -42, 'date': '2026-10-09', 'libelle': 'Café'}
    eb, lx = balance('enable_banking', solde=58), balance('gmail', bankDate='2026-10-08')
    result = compare_balances(eb, lx, [movement])
    assert result['status'] == 'explained' and result['movements'][0]['id'] == 'o'
    assert compare_balances(eb, lx, [{**movement, 'bankStatus': 'pending'}])['status'] == 'waiting'


def test_older_snapshot_cannot_replace_newer_and_bank_date_not_invented():
    s = MemoryStore()
    s.balance(balance('enable_banking'))
    s.balance(balance('enable_banking', solde=1, bankDate='2026-10-08', receivedAt=NOW + timedelta(days=1)))
    assert s.get('bank_balance_sources', digest('LCL', 'enable_banking'))['solde'] == 100
    capture_linxo_balance(s, {'compte': 'LCL', 'solde': 90, 'emailDate': NOW})
    assert s.get('bank_balance_sources', digest('LCL', 'gmail'))['bankDate'] is None
    history = s.all('account_balance_history')
    assert len(history) == 2 and all(row['source'] == 'enable_banking' for row in history)


def test_outage_preserves_balance_when_fallback_freshness_cannot_be_compared():
    eb, lx = balance('enable_banking'), balance('gmail', bankDate=None, balanceType='unknown')
    assert select_balance(eb, lx, True, False) is eb
    assert select_balance(eb, lx, False, False) is lx
