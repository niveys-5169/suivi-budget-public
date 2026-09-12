import pytest
from unittest.mock import MagicMock, patch
from datetime import date, datetime
import sys
import os
src_path = os.path.join(os.path.dirname(__file__), '..', 'src')
sys.path.insert(0, src_path)
import budgets_manager
from budgets_manager import (
    create_budget,
    compute_consumption,
    _calculate_rythme_theorique,
    _validate_budget_data
)
sys.path.remove(src_path)

@pytest.fixture
def mock_db():
    return MagicMock()

def test_validate_budget_data():
    # Valid monthly
    _validate_budget_data({
        "montant": 100,
        "type": "mensuel",
        "periode": {"type": "mois_courant"}
    })
    
    # Invalid monthly
    with pytest.raises(ValueError, match="Le montant doit être supérieur à 0"):
        _validate_budget_data({"montant": 0, "type": "mensuel"})
        
    with pytest.raises(ValueError, match="période de type 'mois_courant'"):
        _validate_budget_data({
            "montant": 100,
            "type": "mensuel",
            "periode": {"type": "annee_civile"}
        })

def test_calculate_rythme_theorique_linear():
    budget = {
        "montant": 1000,
        "type": "mensuel",
        "periode": {"type": "mois_courant"}
    }
    # Mid-month
    ref_dt = date(2026, 2, 15)
    debut = "2026-02-01"
    fin = "2026-02-28"
    
    rythme = _calculate_rythme_theorique(budget, ref_dt, debut, fin)
    # 15 days out of 28
    assert rythme == pytest.approx(1000 * (15/28))

def test_calculate_rythme_theorique_annual_with_months():
    budget = {
        "montant": 2400,
        "type": "annuel",
        "periode": {"type": "annee_civile"},
        "moisAttendus": [2, 3] # Février, Mars
    }
    
    # Fin Janvier -> 0%
    assert _calculate_rythme_theorique(budget, date(2026, 1, 31), "2026-01-01", "2026-12-31") == 0
    
    # Mi-Février -> 0.5 mois sur 2 = 25% de 2400 = 600
    # 15 Février 2026 est le 15ème jour sur 28
    rythme_mid_feb = _calculate_rythme_theorique(budget, date(2026, 2, 14), "2026-01-01", "2026-12-31")
    # 14/28 = 0.5. (0 passed + 0.5 current) / 2 = 0.25. 2400 * 0.25 = 600.
    assert rythme_mid_feb == 600
    
    # Fin Février -> 1 mois sur 2 = 50% = 1200
    assert _calculate_rythme_theorique(budget, date(2026, 2, 28), "2026-01-01", "2026-12-31") == 1200
    
    # Mi-Mars -> (1 + 0.5) / 2 = 75% = 1800
    assert _calculate_rythme_theorique(budget, date(2026, 3, 15), "2026-01-01", "2026-12-31") == pytest.approx(1800, 0.1)

@patch("budgets_manager.get_budget_by_id")
@patch("budgets_manager.get_transactions_by_category_period")
@patch("budgets_manager.get_consumption_cache")
@patch("budgets_manager.set_consumption_cache")
def test_compute_consumption(mock_set_cache, mock_get_cache, mock_get_txs, mock_get_budget, mock_db):
    mock_get_cache.return_value = None
    mock_get_budget.return_value = {
        "id": "b1",
        "nom": "Courses",
        "categorie": "Alimentation",
        "type": "mensuel",
        "montant": 500,
        "periode": {"type": "mois_courant"},
        "actif": True
    }
    mock_get_txs.return_value = [
        {"id": "t1", "montant": -50, "categorie": "Alimentation"},
        {"id": "t2", "montant": -150, "categorie": "Alimentation"},
        {"id": "t3", "montant": 20, "categorie": "Alimentation"}, # Remboursement compté
    ]
    
    res = compute_consumption(mock_db, "b1", reference_date="2026-02-15")
    
    assert res["depense"] == 220
    assert res["reste"] == 280
    assert res["pourcentage"] == 44.0
    assert res["statut"] == "ok"
    assert "t1" in res["transactionIds"]
    assert "t2" in res["transactionIds"]
    assert "t3" in res["transactionIds"]
    
    # Test depassement
    mock_get_txs.return_value = [{"id": "t4", "montant": -600, "categorie": "Alimentation"}]
    res = compute_consumption(mock_db, "b1", reference_date="2026-02-15")
    assert res["statut"] == "depasse"

@patch("budgets_manager.list_budgets")
@patch("budgets_manager.compute_consumption")
def test_compute_all_consumptions(mock_compute, mock_list, mock_db):
    mock_list.return_value = [{"id": "b1"}, {"id": "b2"}]
    mock_compute.side_effect = [{"res": 1}, {"res": 2}]
    
    res = budgets_manager.compute_all_consumptions(mock_db)
    assert len(res) == 2
    assert res[0]["res"] == 1

@patch("budgets_manager.query_budgets")
@patch("budgets_manager.delete_consumption_cache")
def test_invalidate_cache_for_category(mock_delete, mock_query, mock_db):
    mock_query.return_value = [{"id": "b1", "categorie": "Alimentation"}]
    
    budgets_manager.invalidate_cache_for_category(mock_db, "Alimentation", "2026-02-15")
    mock_delete.assert_called_with("b1")
