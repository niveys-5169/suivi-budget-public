"""Tests de la reconstruction de l'historique de valeur d'un bien immobilier."""
import importlib.util
import os
from datetime import date


def _load_backfill():
    path = os.path.join(os.path.dirname(__file__), "..", "scripts", "backfill_property_history.py")
    spec = importlib.util.spec_from_file_location("backfill_property_history", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


backfill = _load_backfill()

# Indice qui double entre 2017 et 2026-T3 : la valeur d'aujourd'hui vaut 2× celle de 2017.
SERIE = {"2017Q1": 100.0, "2017Q2": 100.0, "2017Q3": 110.0, "2020Q1": 150.0, "2026Q3": 200.0}
AUJOURD_HUI = date(2026, 10, 7)


def _plan(**kwargs):
    defaults = dict(
        asset_id="bien1", nom="Maison", owner="Nicolas", montant=400_000.0, serie=SERIE,
        debut=date(2017, 1, 21), premier_releve=date(2026, 9, 1), aujourd_hui=AUJOURD_HUI,
    )
    return backfill.plan_backfill(**{**defaults, **kwargs})


def test_releve_a_la_date_d_achat_puis_chaque_1er_du_mois_jusqu_au_premier_releve_exclu():
    plan = _plan()
    dates = [payload["date"] for _, payload in plan]
    assert dates[:3] == ["2017-01-21", "2017-02-01", "2017-03-01"]
    assert dates[-1] == "2026-08-01"
    assert len(dates) == 1 + (2026 - 2017) * 12 + 7


def test_valeur_reindexee_sur_l_indice_insee():
    par_date = {p["date"]: p["montant"] for _, p in _plan()}
    assert par_date["2017-01-21"] == 200_000.0  # indice 100 / 200
    assert par_date["2017-08-01"] == 220_000.0  # 2017Q3 : 110 / 200
    assert par_date["2020-03-01"] == 300_000.0  # 2020Q1 : 150 / 200


def test_identite_du_releve_identique_au_snapshot_quotidien():
    doc_id, payload = _plan()[0]
    assert doc_id == "bien1_2017-01-21"
    assert payload["assetId"] == "bien1"
    assert payload["type"] == "immobilier"
    assert payload["nom"] == "Maison"
    assert payload["owner"] == "Nicolas"
    assert payload["source"] == "insee_backfill"


def test_ignore_les_dates_avant_le_debut_de_la_serie_insee():
    plan = _plan(debut=date(2016, 11, 15))
    assert plan[0][1]["date"] == "2017-01-01"


def test_sans_indice_ou_sans_montant_rien_a_creer():
    assert _plan(serie={}) == []
    assert _plan(montant=0.0) == []
