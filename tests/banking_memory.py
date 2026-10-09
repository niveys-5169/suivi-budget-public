"""Firestore boundary emulator for banking integration tests (no cloud access)."""
from copy import deepcopy
from threading import RLock
from bank_store import BankStore


class MemoryStore(BankStore):
    def __init__(self):
        self.documents = {}
        self.lock = RLock()

    def get(self, collection, id):
        with self.lock:
            value = self.documents.get((collection, id))
            return {'id': id, **deepcopy(value)} if value is not None else None

    def all(self, collection):
        with self.lock:
            return [self.get(c, id) for c, id in self.documents if c == collection]

    def put(self, collection, id, value):
        with self.lock:
            self.documents.setdefault((collection, id), {}).update(deepcopy(value))

    def atomic(self, collection, id, callback):
        with self.lock:
            value, result = callback(self.get(collection, id) or {})
            if value is not None:
                self.put(collection, id, value)
            return result

    def remove(self, collection, id):
        with self.lock:
            self.documents.pop((collection, id), None)

    def canonical_commit(self, observation, canonical_id, build):
        with self.lock:
            if self.suppressed(observation, canonical_id):
                return False
            old = self.get('transactions', canonical_id)
            self.put('transactions', canonical_id, build(old or {}))
            return not bool(old)

    def merge_rows(self, keep, discard):
        from bank_merge import merge_plan
        with self.lock:
            writes = merge_plan(deepcopy(self.documents), keep, discard)
            for (collection, id), value in writes.items():
                self.put(collection, id, value)
            self.remove('transactions', discard)
