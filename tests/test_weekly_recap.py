"""
tests/test_weekly_recap.py
Tests unitaires pour le récapitulatif hebdomadaire.
"""

from datetime import date, datetime, timezone
from unittest.mock import MagicMock

from weekly_recap import (
    build_weekly_recap_data,
    format_eur,
    normalize_category,
    render_weekly_recap_html,
    render_weekly_recap_text,
    run_weekly_recap,
)


def test_normalize_category():
    assert normalize_category("Épargne") == "epargne"
    assert normalize_category("  Santé & Bien-Être  ") == "sante & bien-etre"
    assert normalize_category("") == ""
    assert normalize_category(None) == ""


def test_format_eur():
    assert "1 250,50" in format_eur(1250.50)
    assert "0,00" in format_eur(0.0)


def test_build_weekly_recap_data():
    ref_date = date(2026, 10, 23)  # Vendredi 23 octobre 2026

    balances = [
        {
            "id": "BforBank",
            "compte": "BforBank",
            "current_balance": 1500.50,
            "status": "reconciled",
            "is_savings": False,
        },
        {
            "id": "LCL",
            "compte": "LCL Joint",
            "solde": 450.00,
            "status": "pending_review",
            "ecart": -15.20,
            "is_savings": False,
        },
        {
            "id": "Livret_A",
            "compte": "Livret A",
            "solde": 10000.00,
            "is_savings": True,  # Doit être ignoré
        },
    ]

    transactions = [
        # Semaine en cours (17 au 23 oct 2026)
        {"date": "2026-10-23", "libelle": "Courses Monoprix", "montant": -85.50, "categorie": "Alimentation"},
        {"date": "2026-10-22", "libelle": "Essence Total", "montant": -60.00, "categorie": "Carburant"},
        {"date": "2026-10-20", "libelle": "Virement interne", "montant": -200.00, "categorie": "Virement interne"},  # Ignoré
        {"date": "2026-10-19", "libelle": "Restaurant", "montant": -45.00, "categorie": "Sorties"},
        {"date": "2026-10-18", "libelle": "Remboursement ami", "montant": 25.00, "categorie": "Sorties"},
        {"date": "2026-10-17", "libelle": "Pharmacie", "montant": -20.00, "categorie": "Santé"},
        # Hors semaine (16 oct 2026) mais dans le mois courant
        {"date": "2026-10-10", "libelle": "Courses début mois", "montant": -250.00, "categorie": "Alimentation"},
        # Mois précédent
        {"date": "2026-09-30", "libelle": "Loyer septembre", "montant": -800.00, "categorie": "Logement"},
    ]

    budgets = [
        {"id": "b_alim", "categorie": "Alimentation", "montant": 300.00, "actif": True},
        {"id": "b_carb", "categorie": "Carburant", "montant": 70.00, "actif": True},
        {"id": "b_sorties", "categorie": "Sorties", "montant": 100.00, "actif": True},
        {"id": "b_revenu", "categorie": "Salaire", "montant": 3000.00, "isIncome": True, "actif": True},  # Ignoré
        {"id": "b_inactif", "categorie": "Loisirs", "montant": 150.00, "actif": False},  # Ignoré
    ]

    monthly_overrides = [
        {"categorie": "Alimentation", "month": "2026-10", "budget": 320.00}
    ]

    data = build_weekly_recap_data(
        balances=balances,
        transactions=transactions,
        budgets=budgets,
        monthly_overrides=monthly_overrides,
        excluded_categories=["ExclueTest"],
        reference_date=ref_date,
    )

    # Soldes
    assert len(data["balances"]["accounts"]) == 2
    assert data["balances"]["total"] == 1950.50
    assert data["balances"]["accounts"][0]["compte"] == "BforBank"
    assert data["balances"]["accounts"][0]["status_label"] == "Rapproché"
    assert data["balances"]["accounts"][1]["status_label"] == "Écart à vérifier"

    # Dépenses de la semaine : 85.50 + 60.00 + 45.00 + 20.00 = 210.50
    assert data["expenses"]["total_expenses"] == 210.50
    assert data["expenses"]["total_income"] == 25.00
    assert len(data["expenses"]["top_transactions"]) == 4
    assert data["expenses"]["top_transactions"][0]["libelle"] == "Courses Monoprix"

    # Budgets
    # Alimentation: depense = 85.50 + 250.00 = 335.50 vs budget 320.00 (override) -> Dépassé (+15.50)
    # Carburant: depense = 60.00 vs budget 70.00 -> 85.7% -> Warning
    # Sorties: depense = -(-45 + 25) = 20.00 vs budget 100.00 -> 20% -> OK (non listé)
    assert len(data["budgets"]["exceeded"]) == 1
    assert data["budgets"]["exceeded"][0]["categorie"] == "Alimentation"
    assert data["budgets"]["exceeded"][0]["depassement"] == 15.50

    assert len(data["budgets"]["warning"]) == 1
    assert data["budgets"]["warning"][0]["categorie"] == "Carburant"
    assert data["budgets"]["warning"][0]["pourcentage"] == 85.7


def test_render_weekly_recap_html_and_text():
    data = {
        "period": {"start": "2026-10-17", "end": "2026-10-23", "month": "2026-10"},
        "balances": {
            "total": 1950.50,
            "accounts": [
                {"compte": "BforBank", "solde": 1500.50, "status_label": "Rapproché", "status_tone": "positive"},
                {"compte": "LCL", "solde": 450.00, "status_label": "Écart", "status_tone": "warning", "ecart": -15.0},
            ],
        },
        "expenses": {
            "total_expenses": 210.50,
            "total_income": 0.0,
            "net": -210.50,
            "categories": [{"categorie": "Alimentation", "montant": 150.0, "pourcentage": 71.3}],
            "top_transactions": [{"date": "2026-10-23", "libelle": "Courses", "montant": 85.50, "categorie": "Alimentation"}],
        },
        "budgets": {
            "exceeded": [{"categorie": "Alimentation", "budget": 300.0, "depense": 320.0, "depassement": 20.0, "pourcentage": 106.7}],
            "warning": [{"categorie": "Carburant", "budget": 100.0, "depense": 85.0, "reste": 15.0, "pourcentage": 85.0}],
        },
    }

    html = render_weekly_recap_html(data)
    assert "Bilan de la semaine" in html
    assert "BforBank" in html
    assert "Alimentation" in html
    assert "106.7%" in html

    text = render_weekly_recap_text(data)
    assert "SUIVI-BUDGET" in text
    assert "BforBank" in text
    assert "106.7%" in text


def test_run_weekly_recap_skipped_when_disabled():
    db = MagicMock()
    gmail = MagicMock()

    doc_ref = MagicMock()
    doc_snap = MagicMock()
    doc_snap.exists = True
    doc_snap.to_dict.return_value = {"enabled": False}
    doc_ref.get.return_value = doc_snap
    db.collection().document.return_value = doc_ref

    res = run_weekly_recap(db, gmail, force=False)
    assert res["status"] == "skipped"
    assert res["reason"] == "disabled"
    gmail.send_html_email.assert_not_called()


def test_run_weekly_recap_success():
    db = MagicMock()
    gmail = MagicMock()
    gmail.get_profile_email.return_value = "user@example.com"
    gmail.send_html_email.return_value = "msg_123"

    config_doc_ref = MagicMock()
    config_snap = MagicMock()
    config_snap.exists = True
    config_snap.to_dict.return_value = {"enabled": True, "recipients": ["custom@example.com"]}
    config_doc_ref.get.return_value = config_snap

    def mock_collection(name):
        col = MagicMock()
        if name == "config":
            col.document.return_value = config_doc_ref
        elif name == "metadata":
            ex_doc = MagicMock()
            ex_snap = MagicMock()
            ex_snap.exists = False
            ex_doc.get.return_value = ex_snap
            col.document.return_value = ex_doc
        elif name == "account_balances":
            col.stream.return_value = []
        elif name == "budgets":
            col.stream.return_value = []
        elif name == "budgets_monthly":
            col.stream.return_value = []
        elif name == "transactions":
            q = MagicMock()
            q.stream.return_value = []
            col.where.return_value = q
        return col

    db.collection.side_effect = mock_collection

    res = run_weekly_recap(db, gmail, force=True, now=datetime(2026, 10, 23, 18, 0, tzinfo=timezone.utc))
    assert res["status"] == "success"
    assert res["messageId"] == "msg_123"
    assert res["recipients"] == ["custom@example.com"]
    gmail.send_html_email.assert_called_once()


def test_build_weekly_recap_data_with_options():
    ref_date = date(2026, 10, 23)
    balances = [{"compte": "BforBank", "current_balance": 1000.0, "is_savings": False}]
    savings = [{"compte": "Livret A", "solde": 5000.0}]

    data = build_weekly_recap_data(
        balances=balances,
        transactions=[],
        budgets=[],
        reference_date=ref_date,
        include_checking=False,
        include_savings=True,
        savings_balances=savings,
        include_expenses=False,
        include_budgets=False,
    )

    assert data["balances"]["accounts"] == []
    assert len(data["balances"]["savings_accounts"]) == 1
    assert data["balances"]["savings_accounts"][0]["compte"] == "Livret A"
    assert data["balances"]["total_savings"] == 5000.0


def test_check_and_run_scheduled_weekly_recap_schedule_mismatch():
    db = MagicMock()
    gmail = MagicMock()
    config_ref = MagicMock()
    config_snap = MagicMock()
    config_snap.exists = True
    config_snap.to_dict.return_value = {"enabled": True, "dayOfWeek": 5, "sendHour": 18}
    config_ref.get.return_value = config_snap
    db.collection().document.return_value = config_ref

    from weekly_recap import check_and_run_scheduled_weekly_recap

    # Test avec un Lundi 18h (2026-10-19 18:00 UTC) au lieu de Vendredi
    res = check_and_run_scheduled_weekly_recap(db, gmail, now=datetime(2026, 10, 19, 18, 0, tzinfo=timezone.utc))
    assert res["status"] == "skipped"
    assert res["reason"] == "schedule_mismatch"
    gmail.send_html_email.assert_not_called()


def test_weekly_recap_escapes_xss_and_filters_cancelled():
    data = {
        "period": {"start": "2026-10-17", "end": "2026-10-23", "month": "2026-10"},
        "balances": {
            "total": 100.0,
            "accounts": [{"compte": "<script>alert(1)</script>", "solde": 100.0, "status_label": "<b>OK</b>", "status_tone": "positive"}],
            "savings_accounts": [{"compte": "<img src=x onerror=alert(2)>", "solde": 500.0}],
            "total_savings": 500.0,
        },
        "expenses": {
            "total_expenses": 50.0,
            "total_income": 0.0,
            "net": -50.0,
            "categories": [{"categorie": "<Cat & Test>", "montant": 50.0, "pourcentage": 100.0}],
            "top_transactions": [{"date": "2026-10-23", "libelle": "<libelle dangerous>", "montant": 50.0, "categorie": "<Cat & Test>"}],
        },
        "budgets": {
            "exceeded": [{"categorie": "<Budget Exceeded>", "budget": 30.0, "depense": 50.0, "depassement": 20.0, "pourcentage": 166.7}],
            "warning": [{"categorie": "<Budget Warning>", "budget": 100.0, "depense": 85.0, "reste": 15.0, "pourcentage": 85.0}],
        },
        "options": {"include_checking": True, "include_savings": True, "include_expenses": True, "include_budgets": True},
    }

    html = render_weekly_recap_html(data)
    assert "<script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "<img" not in html
    assert "&lt;img src=x onerror=alert(2)&gt;" in html
    assert "<libelle dangerous>" not in html
    assert "&lt;libelle dangerous&gt;" in html
    assert "<Cat & Test>" not in html
    assert "&lt;Cat &amp; Test&gt;" in html

    # Test cancelled transactions ignored & current_balance preferred in savings
    ref_date = date(2026, 10, 23)
    txs = [
        {"date": "2026-10-20", "montant": -100.0, "categorie": "Alimentation", "bankStatus": "cancelled"},
        {"date": "2026-10-20", "montant": -50.0, "categorie": "Alimentation"},
    ]
    savings = [{"compte": "Livret", "current_balance": 1200.0, "solde": 1000.0}]
    recap = build_weekly_recap_data(
        balances=[],
        transactions=txs,
        budgets=[{"categorie": "Alimentation", "montant": 200.0}],
        savings_balances=savings,
        include_savings=True,
        reference_date=ref_date,
    )
    assert recap["expenses"]["total_expenses"] == 50.0
    assert recap["balances"]["total_savings"] == 1200.0


