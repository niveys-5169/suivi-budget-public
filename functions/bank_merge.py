"""Explicit choice of surviving user edits; never silently discard conflicts."""
from copy import deepcopy
from datetime import datetime, timezone
from enable_banking_client import BankingError
from google.cloud import firestore


def references(value):
    if isinstance(value, dict):
        return {v for k, v in value.items() if k == 'txId' and isinstance(v, str)} | set().union(*(references(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(*(references(v) for v in value)) if value else set()
    return set()


def retarget(value, old, kept):
    if isinstance(value, list):
        values = [retarget(v, old, kept) for v in value]
        seen, result = set(), []
        for v in values:
            key = v.get('txId') if isinstance(v, dict) else None
            if key and key in seen:
                continue
            if key: seen.add(key)
            result.append(v)
        return result
    if isinstance(value, dict):
        return {k: kept if k == 'txId' and v == old else retarget(v, old, kept) for k, v in value.items()}
    return value


def merge_plan(records, keep, discard):
    recurrence_links = [(key, references(value)) for key, value in records.items() if key[0] == 'recurrences']
    claims = {key for key, refs in recurrence_links if keep in refs or discard in refs}
    if len(claims) > 1:
        raise BankingError('RECURRENCE_LINK_CONFLICT')
    kept, dropped = records.get(('transactions', keep)), records.get(('transactions', discard))
    if not kept or not dropped:
        raise BankingError('CANONICAL_ROW_MISSING')
    writes = {('transactions', keep): {**kept,
        'bankObservationIds': sorted(set(kept.get('bankObservationIds', []) + dropped.get('bankObservationIds', []))),
        'mergedFromIds': sorted(set(kept.get('mergedFromIds', []) + [discard]))},
        ('bank_canonical_aliases', discard): {'canonicalId': keep, 'mergedAt': datetime.now(timezone.utc)},
        ('bank_merge_history', discard): {'keptId': keep, 'discardedId': discard, 'keptFields': kept,
                                        'discardedFields': dropped, 'resolvedAt': datetime.now(timezone.utc)}}
    for key, value in records.items():
        if key[0] == 'recurrences' and discard in references(value):
            writes[key] = retarget(value, discard, keep)
        if key[0] == 'bank_observations' and value.get('canonicalId') == discard:
            writes[key] = {'canonicalId': keep}
    return writes


def merge_rows(store, keep, discard):
    keys = [('transactions', keep), ('transactions', discard)]
    keys += [('recurrences', r['id']) for r in store.all('recurrences')]
    keys += [('bank_observations', o['id']) for o in store.all('bank_observations') if o.get('canonicalId') == discard]
    if len(keys) > 450:
        raise BankingError('MERGE_REQUIRES_MIGRATION')
    refs = {key: store.db.collection(key[0]).document(key[1]) for key in keys}
    @firestore.transactional
    def commit(transaction):
        snapshots = {key: ref.get(transaction=transaction) for key, ref in refs.items()}
        records = {key: snap.to_dict() for key, snap in snapshots.items() if snap.exists}
        writes = merge_plan(records, keep, discard)
        for key, value in writes.items():
            transaction.set(store.db.collection(key[0]).document(key[1]), value, merge=True)
        transaction.delete(refs[('transactions', discard)])
    commit(store.db.transaction())
