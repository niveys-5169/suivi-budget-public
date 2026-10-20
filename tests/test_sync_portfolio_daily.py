"""Tests de sync_portfolio_daily : historisation des positions, y compris soldées."""
import importlib.util
import os
from unittest.mock import MagicMock, patch


def _load_functions_firebase_db():
    """Charge explicitement functions/firebase_db.py (et non src/firebase_db.py).

    sync_portfolio_daily n'existe que côté Cloud Functions. Dans la suite
    complète, d'autres tests insèrent src/ en tête de sys.path à la collecte :
    `import firebase_db` résoudrait alors la version src/.
    """
    path = os.path.join(os.path.dirname(__file__), "..", "functions", "firebase_db.py")
    spec = importlib.util.spec_from_file_location("functions_firebase_db", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


firebase_db = _load_functions_firebase_db()


def _holding(doc_id, **fields):
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = fields
    return doc


def _run(holdings):
    """Exécute la synchro et retourne (count, {docId: payload}) des écritures batch."""
    db = MagicMock()
    db.collection.return_value.document.return_value.get.return_value.exists = True
    db.collection.return_value.document.return_value.get.return_value.to_dict.return_value = {
        "portfolioUid": "uid1"
    }
    written = {}
    batch = db.batch.return_value
    history_col = MagicMock()
    history_col.document.side_effect = lambda doc_id: doc_id
    batch.set.side_effect = lambda doc_id, payload, merge=False: written.__setitem__(
        doc_id, payload
    )
    db.collection.side_effect = lambda name: (
        history_col if name == "placement_history" else db.collection.return_value
    )

    pdb = MagicMock()
    pdb.collection.return_value.stream.return_value = holdings

    with patch.object(firebase_db, "_get_db", return_value=db), patch.object(
        firebase_db, "_get_portfolio_db", return_value=pdb
    ):
        count = firebase_db.sync_portfolio_daily()
    return count, written


def _montants(written):
    return {p["isin"]: p["montant"] for p in written.values()}


def test_position_detenue_historisee_a_sa_valeur():
    count, written = _run(
        [_holding("FR001", isin="FR001", owner="Nicolas", envelope="PER", current_value=3620.24, quantity=10)]
    )
    assert count == 1
    assert _montants(written) == {"FR001": 3620.24}


def test_position_soldee_historisee_a_zero():
    """Sans point à 0, le fill-forward garde indéfiniment la dernière valeur positive."""
    count, written = _run(
        [_holding("FR002", isin="FR002", owner="Nicolas", envelope="PER", current_value=0, quantity=0)]
    )
    assert count == 1
    assert _montants(written) == {"FR002": 0.0}


def test_valeur_absente_sur_position_detenue_ignoree():
    """Cours non chargé : pas de faux zéro pour une position encore détenue."""
    count, written = _run(
        [_holding("FR003", isin="FR003", owner="Nicolas", envelope="PER", quantity=5)]
    )
    assert count == 0
    assert written == {}


def test_valeur_absente_sans_quantite_ignoree():
    count, written = _run([_holding("FR004", isin="FR004", owner="Nicolas", envelope="PER")])
    assert count == 0


def test_portfolio_mirror_and_contracts_persisted():
    """Vérifie que metadata/portfolio_mirror est écrit avec les positions et les comptes."""
    db = MagicMock()
    db.collection.return_value.document.return_value.get.return_value.exists = True
    db.collection.return_value.document.return_value.get.return_value.to_dict.return_value = {
        "portfolioUid": "uid1"
    }
    history_col = MagicMock()
    meta_mirror_doc = MagicMock()
    meta_settings_doc = MagicMock()

    def doc_selector(doc_id):
        if doc_id == "portfolio_mirror":
            return meta_mirror_doc
        if doc_id == "patrimoine_settings":
            return meta_settings_doc
        return MagicMock()

    def col_selector(name):
        if name == "placement_history":
            return history_col
        if name == "metadata":
            m_col = MagicMock()
            m_col.document.side_effect = doc_selector
            return m_col
        return MagicMock()

    db.collection.side_effect = col_selector

    h_doc = _holding(
        "FR001",
        isin="FR001",
        owner="Romane",
        account_id="acc_spirit",
        current_value=1500.0,
        total_cost=1000.0,
        quantity=5,
    )
    acc_doc = MagicMock()
    acc_doc.id = "acc_spirit"
    acc_doc.to_dict.return_value = {
        "label": "Linxea Spirit 2 Romane",
        "envelope": "AV",
        "broker": "Spirica",
    }

    pdb = MagicMock()

    def pdb_col_selector(path):
        m = MagicMock()
        if path.endswith("/holdings"):
            m.stream.return_value = [h_doc]
        elif path.endswith("/accounts"):
            m.stream.return_value = [acc_doc]
        elif path.endswith("/instruments"):
            inst_doc = MagicMock()
            inst_doc.id = "FR001"
            inst_doc.to_dict.return_value = {"name": "Amundi World", "ticker": "CW8"}
            m.stream.return_value = [inst_doc]
        else:
            m.stream.return_value = []
        return m

    pdb.collection.side_effect = pdb_col_selector

    with patch.object(firebase_db, "_get_db", return_value=db), patch.object(
        firebase_db, "_get_portfolio_db", return_value=pdb
    ):
        count = firebase_db.sync_portfolio_daily()

    assert count == 1
    # Vérifie l'écriture dans metadata/portfolio_mirror
    assert meta_mirror_doc.set.called
    mirror_call_payload = meta_mirror_doc.set.call_args[0][0]
    assert mirror_call_payload["totalValue"] == 1500.0
    assert len(mirror_call_payload["holdings"]) == 1
    holding_item = mirror_call_payload["holdings"][0]
    assert holding_item["isin"] == "FR001"
    assert holding_item["name"] == "Amundi World"
    assert holding_item["accountId"] == "acc_spirit"
    assert holding_item["accountLabel"] == "Linxea Spirit 2 Romane"
    assert holding_item["account"] == "AV"
    assert holding_item["broker"] == "Spirica"
    assert holding_item["unrealizedGain"] == 500.0
    assert holding_item["unrealizedGainPct"] == 50.0

