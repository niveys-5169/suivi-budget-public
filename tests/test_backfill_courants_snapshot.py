"""Tests du rattrapage d'un relevé manquant des comptes courants."""
import importlib.util
import os
from datetime import datetime, timezone


def _load_backfill():
    path = os.path.join(
        os.path.dirname(__file__), "..", "scripts", "backfill_courants_snapshot.py"
    )
    spec = importlib.util.spec_from_file_location("backfill_courants_snapshot", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


backfill = _load_backfill()

DATE = "2026-06-01"


def _snapshot(date, nom="LCL", type_="courants", asset_id="nicolas_courant_lcl"):
    return {
        "date": date,
        "assetId": asset_id,
        "nom": nom,
        "montant": 1050.0,
        "type": type_,
        "owner": "nicolas",
    }


def _solde(day, hour, solde, compte="LCL", month=5):
    return {
        "compte": compte,
        "solde": solde,
        "emailDate": datetime(2026, month, day, hour, tzinfo=timezone.utc),
    }


def test_cree_le_releve_depuis_le_dernier_solde_linxo_de_la_veille():
    plan = backfill.plan_backfill(
        DATE,
        [_snapshot("2026-06-03")],
        [_solde(30, 18, 990.0), _solde(31, 8, 995.0), _solde(31, 19, 1000.5)],
    )

    assert plan == [
        (
            "nicolas_courant_lcl_2026-06-01",
            {
                "date": DATE,
                "assetId": "nicolas_courant_lcl",
                "nom": "LCL",
                "montant": 1000.5,
                "type": "courants",
                "owner": "nicolas",
                "source": "linxo_backfill",
                "snapshotAt": datetime(2026, 5, 31, 19, tzinfo=timezone.utc),
            },
        )
    ]


def test_ignore_un_solde_du_jour_meme_ou_trop_ancien():
    plan = backfill.plan_backfill(
        DATE,
        [_snapshot("2026-06-03")],
        [_solde(28, 23, 900.0), _solde(1, 7, 1100.0, month=6)],
    )

    assert plan == []


def test_ne_reecrit_pas_un_compte_deja_releve_a_la_date():
    plan = backfill.plan_backfill(
        DATE,
        [_snapshot(DATE), _snapshot("2026-06-03")],
        [_solde(31, 19, 1000.5)],
    )

    assert plan == []


def test_ne_concerne_que_les_comptes_courants_deja_historises():
    plan = backfill.plan_backfill(
        DATE,
        [_snapshot("2026-06-04", nom="Livret A", type_="epargne", asset_id="nicolas_livret_a")],
        [_solde(31, 19, 5000.0, compte="Livret A"), _solde(31, 19, 50.0, compte="Ancien compte")],
    )

    assert plan == []
