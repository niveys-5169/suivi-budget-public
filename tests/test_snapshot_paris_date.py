"""Les snapshots patrimoine sont datés en Europe/Paris, jamais en UTC serveur.

Entre 22h/23h UTC et minuit UTC, il est déjà « demain » à Paris : une clé de
date UTC écrirait le snapshot sur la veille côté application.
"""
import importlib.util
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


def _load_functions_firebase_db():
    path = os.path.join(os.path.dirname(__file__), "..", "functions", "firebase_db.py")
    spec = importlib.util.spec_from_file_location("functions_firebase_db_paris", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


firebase_db = _load_functions_firebase_db()


def _frozen_datetime(utc_now):
    fake = MagicMock(wraps=datetime)
    fake.now.side_effect = lambda tz=None: utc_now.astimezone(tz) if tz else utc_now
    return fake


def _snapshot_dates(utc_now):
    db = MagicMock()
    placement = MagicMock()
    placement.id = "livret-a"
    placement.to_dict.return_value = {"nom": "Livret A", "montant": 100, "type": "epargne"}
    history_col = MagicMock()
    history_col.document.side_effect = lambda doc_id: doc_id
    written = {}
    db.batch.return_value.set.side_effect = lambda doc_id, payload, merge=False: written.__setitem__(
        doc_id, payload
    )

    def collection(name):
        col = MagicMock()
        col.stream.return_value = [placement] if name == "placements" else []
        return history_col if name == "placement_history" else col

    db.collection.side_effect = collection
    with patch.object(firebase_db, "_get_db", return_value=db), patch.object(
        firebase_db, "charger_account_owners_mapping", return_value={}
    ), patch.object(firebase_db, "datetime", _frozen_datetime(utc_now)):
        firebase_db.take_patrimoine_snapshot()
    return written


def test_snapshot_apres_minuit_paris_mais_avant_minuit_utc():
    # 31/10/2026 23:30 UTC = 01/11/2026 00:30 à Paris (CET, UTC+1).
    written = _snapshot_dates(datetime(2026, 10, 31, 23, 30, tzinfo=timezone.utc))
    assert "livret-a_2026-11-01" in written
    assert {p["date"] for p in written.values()} == {"2026-11-01"}


def test_snapshot_ete_apres_minuit_paris_mais_avant_minuit_utc():
    # 30/06/2026 22:30 UTC = 01/07/2026 00:30 à Paris (CEST, UTC+2).
    written = _snapshot_dates(datetime(2026, 6, 30, 22, 30, tzinfo=timezone.utc))
    assert {p["date"] for p in written.values()} == {"2026-07-01"}


def test_snapshot_planifie_a_0h05_utc_garde_le_meme_jour():
    written = _snapshot_dates(datetime(2026, 10, 25, 0, 5, tzinfo=timezone.utc))
    assert {p["date"] for p in written.values()} == {"2026-10-25"}
