"""30-day observation preview; --apply-links writes evidence/certain links only."""
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from bank_store import BankStore
from bank_observations import normalize_enable, normalize_linxo
from bank_reconciliation import reconcile, instant
from bank_balances import choose_enable_balance
from enable_banking_client import EnableBankingClient
from firebase_db import _get_db, _transaction_id, _legacy_transaction_id, charger_mapping_categories_linxo, charger_emails_exclus


def attach_existing(store, observations):
    from bank_linxo_identity import existing_original_rows
    for observation in observations:
        original_date = instant(observation['date'])
        ids = [_transaction_id(observation['compte'], original_date, observation['libelle'], observation['montant']),
               _legacy_transaction_id(original_date, observation['libelle'], observation['montant'])]
        existing = existing_original_rows(store, observation)
        existing += [id for id in ids if store.get('deleted_transactions', id) and id not in existing]
        if len(existing) == 1:
            observation['canonicalId'] = existing[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply-links', action='store_true', help='Write original evidence and certain links, never financial amounts')
    args = parser.parse_args()
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=30)).date().isoformat()
    store, client = BankStore(_get_db()), EnableBankingClient()
    eb, balances = [], []
    for connection in store.all('bank_connections'):
        private = store.get('eb_sessions', connection['id'])
        if not private:
            continue
        client.session(private['sessionId'])
        for account in private.get('accounts', []):
            if not account.get('compte'):
                continue
            eb += normalize_enable(client.transactions(account['accountUid'], since), account, now)
            selected = choose_enable_balance(client.balances(account['accountUid']))
            if selected:
                balances.append({'compte': account['compte'], 'source': 'enable_banking',
                    'solde': float(selected['balance_amount']['amount']), 'currency': selected['balance_amount']['currency'],
                    'balanceType': selected['balance_type'], 'bankDate': selected.get('reference_date') or selected.get('last_change_date_time'),
                    'receivedAt': now})
    # Collector preserves authenticated-sender checks and exclusions, and performs no writes/labels.
    from importer import _collecter_messages, get_credentials
    from gmail_client import GmailClient
    gmail = GmailClient(get_credentials())
    messages = gmail.search_emails_complete('from:assistance@linxo.com newer_than:30d')
    txs, linxo_balances, _, _ = _collecter_messages(gmail, messages, charger_mapping_categories_linxo(), charger_emails_exclus())
    lx = normalize_linxo(txs)
    attach_existing(store, lx)
    result = reconcile(eb, lx)
    result.update({'mode': 'apply-links' if args.apply_links else 'preview', 'financialWrites': False,
                   'accounts': sorted({o['compte'] for o in eb}), 'enableCount': len(eb), 'linxoCount': len(lx),
                   'balances': balances, 'linxoBalances': linxo_balances})
    if args.apply_links:
        from bank_lock import banking_write_lock
        with banking_write_lock(store):
            store.observe_unlocked(eb + lx)
            index = {o['id']: o for o in eb + lx}
            for aid, bid in result['matches']:
                a, b = index[aid], index[bid]
                existing_a, existing_b = store.get('bank_observations', aid), store.get('bank_observations', bid)
                if existing_a.get('linxoObservationId') not in (None, bid) or existing_b.get('enableObservationId') not in (None, aid):
                    continue
                if existing_a.get('canonicalId') and existing_b.get('canonicalId') and existing_a['canonicalId'] != existing_b['canonicalId']:
                    continue
                canonical = b.get('canonicalId')
                store.put('bank_observations', aid, {'linxoObservationId': bid, **({'canonicalId': canonical} if canonical else {})})
                store.put('bank_observations', bid, {'enableObservationId': aid})
                if canonical and store.get('transactions', canonical):
                    previous = store.get('transactions', canonical)
                    store.put('transactions', canonical, {'bankObservationIds': list(set(previous.get('bankObservationIds', []) + [aid, bid])), 'linxoStatus': 'matched'})
    print(json.dumps(result, ensure_ascii=False, default=str, indent=2))


if __name__ == '__main__':
    main()
