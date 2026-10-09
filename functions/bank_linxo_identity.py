"""Recognize repeated email occurrences without changing source evidence."""
from bank_reconciliation import compatible, normalize_label, instant


def existing_original_rows(store, observation):
    from firebase_db import _transaction_id, _legacy_transaction_id
    date = instant(observation['date'])
    current = _transaction_id(observation['compte'], date, observation['libelle'], observation['montant'])
    legacy = _legacy_transaction_id(date, observation['libelle'], observation['montant'])
    result = []
    for id in dict.fromkeys([current, legacy]):
        row = store.get('transactions', id)
        if row and (id == current or (row.get('bankOriginal') or {}).get('compte', row.get('compte')) == observation['compte']):
            result.append(id)
    return result


def attach_legacy_rows(store, observations):
    """Observation-only imports precede legacy writes: recover those IDs on activation."""
    used = {o['canonicalId'] for o in observations if o.get('canonicalId') and not o.get('supersededBy')}
    for observation in sorted(observations, key=lambda o: instant(o['receivedAt'])):
        if observation['source'] != 'gmail' or observation.get('canonicalId') or observation.get('supersededBy'):
            continue
        available = [id for id in existing_original_rows(store, observation) if id not in used]
        if len(available) == 1:
            observation['canonicalId'] = available[0]
            used.add(available[0])
            store.put('bank_observations', observation['id'], {'canonicalId': available[0]})


def link_repeated_notifications(store, incoming):
    old = [o for o in store.all('bank_observations') if o['source'] == 'gmail' and not o.get('supersededBy')]
    consumed = set()
    for current in incoming:
        if store.get('bank_observations', current['id']):
            continue
        candidates = [o for o in old if o['id'] not in consumed and o.get('messageId') != current.get('messageId')
                      and o.get('occurrence', 1) == current.get('occurrence', 1) and
                      compatible(current, o) and abs((instant(current['date']) - instant(o['date'])).days) <= 3
                      and (str(current['date'])[:10] != str(o['date'])[:10] or current['bankStatus'] == 'booked')
                      and o['bankStatus'] == 'pending' and
                      normalize_label(o['libelle']) in ('INSTANTANE', 'SEPA')]
        # Different notices can cover several equal payments; preserve the maximum multiplicity.
        if len(candidates) == 1:
            previous = candidates[0]
            current['canonicalId'] = previous.get('canonicalId') or previous['id']
            current['repeatedObservationId'] = previous['id']
            if previous.get('enableObservationId'):
                current['enableObservationId'] = previous['enableObservationId']
                store.put('bank_observations', previous['enableObservationId'], {'linxoObservationId': current['id']})
            consumed.add(previous['id'])
            store.put('bank_observations', previous['id'], {'supersededBy': current['id']})
        old.append(current)
