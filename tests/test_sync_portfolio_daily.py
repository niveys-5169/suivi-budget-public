"""Tests de sync_portfolio_daily : historisation des positions, y compris soldées."""
from unittest.mock import MagicMock, patch

import firebase_db


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
