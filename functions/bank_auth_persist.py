"""Publish a renewed session using the latest mapping under the shared lease."""
from bank_lock import banking_write_lock
from bank_observations import digest
from enable_banking_client import BankingError


def persist_session(store, pending, session, state_id, now):
    with banking_write_lock(store):
        cid = pending['connectionId']
        old = store.get('bank_connections', cid) or {}
        mapping = {a['stableId']: a for a in old.get('accounts', [])}
        accounts, seen = [], set()
        for account in session.get('accounts', []):
            identity = account.get('identification_hash') or account.get('account_id')
            if not identity:
                raise BankingError('ACCOUNT_IDENTITY_MISSING')
            stable = account.get('identification_hash') or digest(pending['bank'], identity)
            if stable in seen:
                raise BankingError('ACCOUNT_IDENTITY_AMBIGUOUS')
            seen.add(stable)
            previous = mapping.get(stable, {})
            accounts.append({'stableId': stable, 'name': account.get('name') or account.get('details') or 'Compte bancaire',
                'currency': account.get('currency', ''), 'compte': previous.get('compte', ''),
                'enabled': previous.get('enabled', False), 'accountUid': account['uid']})
        store.put('eb_sessions', cid, {'sessionId': session['session_id'], 'accounts': accounts})
        store.put('bank_connections', cid, {'ownerUid': pending['ownerUid'], 'bank': pending['bank'],
            'accounts': [{k: v for k, v in a.items() if k != 'accountUid'} for a in accounts],
            'status': 'active', 'errorCode': None, 'errorSince': None,
            'validUntil': session.get('access', {}).get('valid_until'), 'createdAt': old.get('createdAt') or now})
        store.put('eb_pending_auth', state_id, {'status': 'completed', 'completedAt': now})
        return cid
