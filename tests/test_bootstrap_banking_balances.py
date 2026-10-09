"""Historical preparation must refresh source balances without replaying money."""
import importlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from banking_memory import MemoryStore
from bank_observations import digest


@pytest.mark.parametrize('apply', [False, True])
def test_bootstrap_preserves_latest_email_balance_and_financial_rows(monkeypatch, apply, capsys):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / 'scripts'))
    bootstrap = importlib.import_module('bootstrap_banking_observations')
    import importer
    import gmail_client
    now = datetime(2026, 10, 9, 8, tzinfo=timezone.utc)
    store = MemoryStore()
    store.balance({'compte': 'LCL', 'source': 'gmail', 'solde': 100,
                   'currency': 'EUR', 'balanceType': 'unknown', 'bankDate': None,
                   'receivedAt': now - timedelta(days=2)})
    store.put('account_balances', 'LCL', {'source': 'enable_banking', 'solde': 120})
    store.put('transactions', 'existing', {'montant': -20, 'commentaire': 'Conserver'})
    emails = [{'compte': 'LCL', 'solde': 150, 'emailDate': now},
              {'compte': 'LCL', 'solde': 80, 'emailDate': now - timedelta(days=1)}]
    monkeypatch.setattr(bootstrap, 'BankStore', lambda _: store)
    monkeypatch.setattr(bootstrap, '_get_db', lambda: object())
    monkeypatch.setattr(bootstrap, 'EnableBankingClient', lambda: object())
    monkeypatch.setattr(bootstrap, 'charger_mapping_categories_linxo', lambda: {})
    monkeypatch.setattr(bootstrap, 'charger_emails_exclus', lambda: set())
    monkeypatch.setattr(importer, 'get_credentials', lambda: object())
    monkeypatch.setattr(gmail_client, 'GmailClient', lambda _: SimpleNamespace(search_emails_complete=lambda _: []))
    monkeypatch.setattr(importer, '_collecter_messages', lambda *args: ([], emails, [], []))
    monkeypatch.setattr(sys, 'argv', ['bootstrap'] + (['--apply-links'] if apply else []))

    bootstrap.main()

    source = store.get('bank_balance_sources', digest('LCL', 'gmail'))
    assert source['solde'] == (150 if apply else 100)
    assert source['bankDate'] is None
    assert source['receivedAt'] == (now if apply else now - timedelta(days=2))
    assert store.get('account_balances', 'LCL')['solde'] == 120
    assert store.all('transactions') == [{'id': 'existing', 'montant': -20, 'commentaire': 'Conserver'}]
    result = json.loads(capsys.readouterr().out)
    assert result['staleLinxoBalancesBefore'] == 1
    assert result['staleLinxoBalancesAfter'] == (0 if apply else 1)
