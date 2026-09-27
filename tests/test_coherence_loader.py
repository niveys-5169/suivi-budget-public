"""Tests de `charger_transactions_pour_coherence` (copies src/ et functions/).

Le contrôle de cohérence ne retient que les transactions dont l'emailDate est
postérieure à celle du solde stocké : la requête bornée doit produire la même
fenêtre que l'ancien scan complet, tout en lisant moins de documents.
"""

import importlib.util
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def _load(copy: str):
    spec = importlib.util.spec_from_file_location(
        f"firebase_db_{copy}", ROOT / copy / "firebase_db.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Doc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class _Query:
    def __init__(self, docs, filters=()):
        self._docs = docs
        self.filters = list(filters)

    def select(self, _fields):
        return self

    def where(self, filter):
        return _Query(self._docs, self.filters + [filter])

    def stream(self, timeout=None):
        out = self._docs
        for f in self.filters:
            assert f.op_string == ">=", f.op_string
            out = [
                d for d in out
                if isinstance(d.to_dict().get(f.field_path), datetime)
                and d.to_dict()[f.field_path] >= f.value
            ]
        return out


class _FakeDb:
    def __init__(self, balances, transactions):
        self.balances = balances
        self.tx_query = _Query([_Doc(i, d) for i, d in transactions.items()])
        self.last_tx_query = None

    def collection(self, name):
        db = self

        class _Col:
            def document(self, doc_id):
                class _Ref:
                    def get(self):
                        return _Doc(doc_id, db.balances.get(doc_id))
                return _Ref()

            def select(self, fields):
                db.last_tx_query = db.tx_query.select(fields)
                return _Tracking(db)

        assert name in ("account_balances", "transactions"), name
        return _Col()


class _Tracking:
    """Enregistre la dernière requête transactions construite."""

    def __init__(self, db):
        self.db = db
        self.query = db.tx_query

    def where(self, filter):
        self.query = self.query.where(filter=filter)
        self.db.last_tx_query = self.query
        return self

    def stream(self, timeout=None):
        return self.query.stream(timeout)


def _dt(day):
    return datetime(2026, 9, day, 8, 0, tzinfo=timezone.utc)


def _tx(compte, day, montant):
    return {"date": f"2026-09-{day:02d}", "libelle": f"op {compte} {day}",
            "montant": montant, "compte": compte, "emailDate": _dt(day)}


TRANSACTIONS = {
    "a1": _tx("BforBank", 1, -10.0),
    "a2": _tx("BforBank", 5, -20.0),
    "a3": _tx("BforBank", 9, -30.0),
    "b1": _tx("LCL", 2, 100.0),
    "b2": _tx("LCL", 8, -5.0),
    "manuel": {"date": "2026-09-07", "libelle": "saisie", "montant": -1.0, "compte": "LCL"},
}


@pytest.fixture(params=["functions", "src"])
def fdb(request, monkeypatch):
    module = _load(request.param)
    return module, monkeypatch


def _use(fdb, balances):
    module, monkeypatch = fdb
    db = _FakeDb(balances, TRANSACTIONS)
    monkeypatch.setattr(module, "_get_db", lambda: db)
    return module, db


def test_borne_par_la_plus_ancienne_email_date(fdb):
    module, db = _use(fdb, {
        "BforBank": {"solde": 1.0, "emailDate": _dt(4)},
        "LCL": {"solde": 2.0, "emailDate": _dt(6)},
    })
    rows = module.charger_transactions_pour_coherence(["BforBank", "LCL", "BforBank"])

    [f] = db.last_tx_query.filters
    assert (f.field_path, f.op_string, f.value) == ("emailDate", ">=", _dt(4))
    assert sorted(r["id"] for r in rows) == ["a2", "a3", "b2"]


def test_repli_scan_complet_si_email_date_absente(fdb):
    module, db = _use(fdb, {
        "BforBank": {"solde": 1.0, "emailDate": _dt(4)},
        "LCL": {"solde": 2.0},
    })
    rows = module.charger_transactions_pour_coherence(["BforBank", "LCL"])

    assert db.last_tx_query.filters == []
    assert len(rows) == len(TRANSACTIONS)


def test_compte_sans_solde_stocke_ignore(fdb):
    module, db = _use(fdb, {})
    assert module.charger_transactions_pour_coherence(["BforBank"]) == []
    assert db.last_tx_query is None


def test_meme_fenetre_que_le_scan_complet(fdb):
    """Pour chaque compte, filter_window_transactions donne le même résultat."""
    from balance_coherence import filter_window_transactions

    balances = {
        "BforBank": {"solde": 1.0, "emailDate": _dt(4)},
        "LCL": {"solde": 2.0, "emailDate": _dt(6)},
    }
    module, _ = _use(fdb, balances)
    bornees = module.charger_transactions_pour_coherence(list(balances))
    completes = module.charger_transactions_existantes_pour_dedoublonnage(since_days=0)

    for compte, solde in balances.items():
        upper = _dt(30)
        attendu = filter_window_transactions(completes, compte, solde["emailDate"], upper)
        obtenu = filter_window_transactions(bornees, compte, solde["emailDate"], upper)
        assert [t["id"] for t in obtenu] == [t["id"] for t in attendu]
        assert attendu  # la fenêtre testée n'est pas vide
