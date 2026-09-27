"""`sauvegarder_soldes_comptes` ne régresse jamais le solde courant (copies src/ et functions/).

Un mail Linxo plus ancien que le solde stocké (reparse, mail retraité par la
Cloud Function après l'import GitHub Actions, file bornée par run…) ne doit
écrire que l'historique : account_balances/{compte} garde le solde du mail le
plus récent.
"""

import importlib.util
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent

ANCIEN = datetime(2026, 9, 20, 8, 0, tzinfo=timezone.utc)
RECENT = datetime(2026, 9, 24, 8, 0, tzinfo=timezone.utc)


def _load(copy: str):
    spec = importlib.util.spec_from_file_location(
        f"firebase_db_soldes_{copy}", ROOT / copy / "firebase_db.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Snap:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class _FakeDb:
    """account_balances lisible ; les écritures du batch sont enregistrées."""

    def __init__(self, balances):
        self.balances = balances
        self.writes = []  # (collection, doc_id, payload)

    def collection(self, name):
        db = self

        class _Ref:
            def __init__(self, doc_id):
                self.col = name
                self.id = doc_id

            def get(self):
                return _Snap(db.balances.get(self.id) if name == "account_balances" else None)

        class _Col:
            def document(self, doc_id):
                return _Ref(doc_id)

        return _Col()

    def batch(self):
        db = self

        class _Batch:
            def set(self, ref, payload, merge=False):
                db.writes.append((ref.col, ref.id, payload))

            def commit(self):
                pass

        return _Batch()

    def latest(self, compte):
        return [p for col, doc_id, p in self.writes if col == "account_balances" and doc_id == compte]

    def history(self):
        return [p for col, _, p in self.writes if col == "account_balance_history"]


@pytest.fixture(params=["src", "functions"])
def fdb(request, monkeypatch):
    module = _load(request.param)
    monkeypatch.setattr(module, "charger_account_owners_mapping", lambda: {})
    monkeypatch.setattr(module, "get_owner_for_account", lambda compte, mapping: "Nicolas")
    monkeypatch.setattr(module, "_run_with_backoff", lambda operation, _label: operation())
    return module


def _solde(montant, email_date, compte="BforBank"):
    return {"compte": compte, "solde": montant, "emailDate": email_date, "status": "OK"}


def test_mail_plus_ancien_que_le_solde_stocke_ne_l_ecrase_pas(fdb, monkeypatch):
    db = _FakeDb({"BforBank": {"solde": 307.60, "emailDate": RECENT}})
    monkeypatch.setattr(fdb, "_get_db", lambda: db)

    fdb.sauvegarder_soldes_comptes([_solde(515.98, ANCIEN)])

    assert db.latest("BforBank") == []
    # L'historique garde la trace du mail rejoué.
    assert [p["solde"] for p in db.history()] == [515.98]


def test_mail_plus_recent_met_a_jour_le_solde(fdb, monkeypatch):
    db = _FakeDb({"BforBank": {"solde": 515.98, "emailDate": ANCIEN}})
    monkeypatch.setattr(fdb, "_get_db", lambda: db)

    fdb.sauvegarder_soldes_comptes([_solde(307.60, RECENT)])

    assert [p["solde"] for p in db.latest("BforBank")] == [307.60]


def test_meme_mail_rejoue_reecrit_le_solde(fdb, monkeypatch):
    db = _FakeDb({"BforBank": {"solde": 300.00, "emailDate": RECENT}})
    monkeypatch.setattr(fdb, "_get_db", lambda: db)

    fdb.sauvegarder_soldes_comptes([_solde(307.60, RECENT)])

    assert [p["solde"] for p in db.latest("BforBank")] == [307.60]


def test_solde_stocke_sans_emaildate_est_ecrase(fdb, monkeypatch):
    db = _FakeDb({"BforBank": {"solde": 100.0}})
    monkeypatch.setattr(fdb, "_get_db", lambda: db)

    fdb.sauvegarder_soldes_comptes([_solde(307.60, ANCIEN)])

    assert [p["solde"] for p in db.latest("BforBank")] == [307.60]


def test_lot_dans_le_desordre_garde_le_plus_recent(fdb, monkeypatch):
    db = _FakeDb({})
    monkeypatch.setattr(fdb, "_get_db", lambda: db)

    fdb.sauvegarder_soldes_comptes([_solde(307.60, RECENT), _solde(515.98, ANCIEN)])

    assert [p["solde"] for p in db.latest("BforBank")] == [307.60]
    assert sorted(p["solde"] for p in db.history()) == [307.60, 515.98]
