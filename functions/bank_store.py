"""Firestore banking repository. All authoritative writes are server-owned."""
from google.cloud import firestore


class BankStore:
    def __init__(self, db):
        self.db = db

    def get(self, collection, id):
        snap = self.db.collection(collection).document(id).get()
        return {"id": snap.id, **snap.to_dict()} if snap.exists else None

    def all(self, collection):
        return [{"id": s.id, **(s.to_dict() or {})} for s in self.db.collection(collection).stream()]

    def put(self, collection, id, data):
        self.db.collection(collection).document(id).set(data, merge=True)

    def atomic(self, collection, id, callback):
        ref = self.db.collection(collection).document(id)
        @firestore.transactional
        def run(transaction):
            snap = ref.get(transaction=transaction)
            data, result = callback(snap.to_dict() if snap.exists else {})
            if data is not None:
                transaction.set(ref, data, merge=True)
            return result
        return run(self.db.transaction())

    def observe(self, items):
        from bank_lock import banking_write_lock
        with banking_write_lock(self):
            return self.observe_unlocked(items)

    def observe_unlocked(self, items):
        from bank_reconciliation import strong_match, compatible
        existing = self.all("bank_observations")
        for item in items:
            previous = self.get("bank_observations", item["id"]) or {}
            if not previous and item["source"] == "enable_banking" and item["bankStatus"] == "booked":
                pending = [o for o in existing if o["source"] == "enable_banking" and o.get("bankStatus") == "pending"
                           and not o.get("supersededBy") and strong_match(item, o) and
                           (not o.get('reference') or not item.get('reference'))]
                if len(pending) == 1 and sum(strong_match(other, pending[0]) for other in items) == 1:
                    previous = pending[0]
                    self.put("bank_observations", previous["id"], {"supersededBy": item["id"]})
                    for key in ("canonicalId", "linxoObservationId", "distinctFrom"):
                        if key in previous:
                            item[key] = previous[key]
                    if previous.get('linxoObservationId'):
                        self.put('bank_observations', previous['linxoObservationId'], {'enableObservationId': item['id']})
                else:
                    item['transitionCandidates'] = [o['id'] for o in existing if o['source'] == 'enable_banking'
                        and o.get('bankStatus') == 'pending' and o.get('canonicalId') and not o.get('supersededBy')
                        and compatible(item, o) and (not o.get('reference') or not item.get('reference'))
                        and o['id'] not in item.get('distinctFrom', [])]
            item = {**item, "firstSeenAt": previous.get("firstSeenAt") or item["receivedAt"],
                    "firstBookedAt": previous.get("firstBookedAt") or item.get("firstBookedAt")}
            if previous.get('bankStatus') == 'booked' and item['bankStatus'] == 'pending':
                item['bankStatus'] = 'booked'
            if item.get('canonicalId') is None and previous.get('canonicalId'):
                item['canonicalId'] = previous['canonicalId']
            # Links are never cleared by a replay.
            self.put("bank_observations", item["id"], item)

    def balance(self, value):
        from bank_lock import banking_write_lock
        with banking_write_lock(self):
            return self.balance_unlocked(value)

    def balance_unlocked(self, value):
        from bank_balance_store import store_balance
        return store_balance(self, value)

    def suppressed(self, observation, canonical_id):
        from firebase_db import _transaction_id, _legacy_transaction_id
        from bank_reconciliation import instant
        legacy = [_transaction_id(observation["compte"], instant(observation["date"]), observation["libelle"], observation["montant"]),
                  _legacy_transaction_id(instant(observation["date"]), observation["libelle"], observation["montant"])]
        return any(self.get("deleted_transactions", id) for id in [canonical_id, observation["id"], *legacy])

    def canonical_commit(self, observation, canonical_id, build):
        from firebase_db import _transaction_id, _legacy_transaction_id
        from bank_reconciliation import instant
        legacy = [_transaction_id(observation['compte'], instant(observation['date']), observation['libelle'], observation['montant']),
                  _legacy_transaction_id(instant(observation['date']), observation['libelle'], observation['montant'])]
        ref = self.db.collection('transactions').document(canonical_id)
        tombs = [self.db.collection('deleted_transactions').document(id)
                 for id in set([canonical_id, observation['id'], *legacy])]
        @firestore.transactional
        def run(transaction):
            # Read all tombstones before writing, so a concurrent client deletion wins.
            deleted = [t.get(transaction=transaction).exists for t in tombs]
            previous = ref.get(transaction=transaction)
            if any(deleted):
                return False
            transaction.set(ref, build(previous.to_dict() if previous.exists else {}), merge=True)
            return not previous.exists
        return run(self.db.transaction())

    def publish(self, observation, canonical_id, state, linxo=None):
        seen = set()
        while canonical_id not in seen:
            seen.add(canonical_id)
            alias = self.get('bank_canonical_aliases', canonical_id)
            if not alias:
                break
            canonical_id = alias['canonicalId']
        else:
            from enable_banking_client import BankingError
            raise BankingError('CANONICAL_ALIAS_CYCLE')
        original = {'date': observation['date'], 'compte': observation['compte'],
                    'montant': observation['montant'], 'libelle': observation['libelle'],
                    'source': observation['source'], 'categorie': observation.get('categorie', ''), 'pointe': False}
        def build(old):
            previous_original = old.get('bankOriginal', {})
            editable = {k: old[k] for k in ('date', 'compte', 'montant', 'libelle', 'categorie', 'commentaire', 'pointe', 'moisAffectation')
                        if k in old and (k in ('categorie', 'commentaire', 'pointe', 'moisAffectation') or
                                         k not in previous_original or str(old[k]) != str(previous_original[k]))}
            payload = {**original, **editable, 'bankOriginal': original, 'bankStatus': observation['bankStatus'],
                       'enAttente': observation['bankStatus'] == 'pending', 'linxoStatus': state,
                       'bankObservationIds': list(set(old.get('bankObservationIds', []) + [observation['id']] + ([linxo['id']] if linxo else []))),
                       'firstBookedAt': observation.get('firstBookedAt'), 'importedAt': old.get('importedAt') or observation['receivedAt']}
            if linxo:
                payload['emailDate'] = linxo['receivedAt']
            if observation['source'] == 'gmail' and old.get('source') == 'enable_banking':
                payload.update({'bankStatus': old.get('bankStatus'), 'firstBookedAt': old.get('firstBookedAt'),
                                'enAttente': old.get('bankStatus') == 'pending'})
            return payload
        inserted = self.canonical_commit(observation, canonical_id, build)
        from bank_cycle import update_linked_approvals
        update_linked_approvals(self, canonical_id)
        self.put('bank_observations', observation['id'], {'canonicalId': canonical_id})
        if linxo:
            self.put('bank_observations', linxo['id'], {'canonicalId': canonical_id})
        return inserted

    def merge_rows(self, keep, discard):
        from bank_merge import merge_rows
        merge_rows(self, keep, discard)
