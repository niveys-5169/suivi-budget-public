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
            "variables": [
                {"categorie": "Alimentation", "budget": 300.0, "depense": 320.0, "depassement": 20.0, "reste": -20.0, "pourcentage": 106.7,
                 "depense_mois_precedent": 250.0, "ecart_mois_precedent": 70.0},
                {"categorie": "Carburant", "budget": 100.0, "depense": 85.0, "depassement": -15.0, "reste": 15.0, "pourcentage": 85.0,
                 "depense_mois_precedent": 90.0, "ecart_mois_precedent": -5.0},
            ],
            "exceeded": [{"categorie": "Alimentation", "budget": 300.0, "depense": 320.0, "depassement": 20.0, "reste": -20.0, "pourcentage": 106.7}],
            "warning": [{"categorie": "Carburant", "budget": 100.0, "depense": 85.0, "depassement": -15.0, "reste": 15.0, "pourcentage": 85.0}],
            "envelopes": [{"categorie": "Vacances ski", "budget": 2500.0, "depense": 300.0, "reste": 2200.0, "pourcentage": 12.0, "echeance": "2027-02"}],
        },
    }

    html = render_weekly_recap_html(data)
    assert "Bilan de la semaine" in html
    assert "BforBank" in html
    assert "Alimentation" in html
    assert "106.7%" in html
    assert "M-1 à date" in html
    assert "Vacances ski" in html
    assert "02/2027" in html

    text = render_weekly_recap_text(data)
    assert "SUIVI-BUDGET" in text
    assert "BforBank" in text
    assert "106.7%" in text
    assert "ENVELOPPES ANNUELLES" in text
    assert "Vacances ski (échéance 02/2027)" in text


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
            "variables": [
                {"categorie": "<Budget Exceeded>", "budget": 30.0, "depense": 50.0, "depassement": 20.0, "reste": -20.0, "pourcentage": 166.7},
                {"categorie": "<Budget Warning>", "budget": 100.0, "depense": 85.0, "depassement": -15.0, "reste": 15.0, "pourcentage": 85.0},
            ],
            "exceeded": [{"categorie": "<Budget Exceeded>", "budget": 30.0, "depense": 50.0, "depassement": 20.0, "reste": -20.0, "pourcentage": 166.7}],
            "warning": [{"categorie": "<Budget Warning>", "budget": 100.0, "depense": 85.0, "depassement": -15.0, "reste": 15.0, "pourcentage": 85.0}],
            "envelopes": [{"categorie": "<Env & XSS>", "budget": 100.0, "depense": 10.0, "reste": 90.0, "pourcentage": 10.0, "echeance": "2026-12"}],
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
    assert "<Env & XSS>" not in html
    assert "&lt;Env &amp; XSS&gt;" in html

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




def _recap_budgets_variables_fixture():
    budgets = [
        {"id": "Nourriture", "categorie": "Nourriture", "montant": 700.0, "type": "mensuel", "actif": True},
        # Doublon legacy (auto-ID) : la fiche à ID déterministe l'emporte, comme dans l'app
        {"id": "aZ09legacy", "categorie": "Nourriture", "montant": 8400.0, "type": "annuel", "actif": True},
        {"id": "Achats shopping autres", "categorie": "Achats shopping autres", "montant": 667.0, "type": "mensuel", "actif": True},
        {"id": "Fibre SFR", "categorie": "Fibre SFR", "montant": 329.64, "type": "annuel", "actif": True},
        {"id": "Crédit Maison", "categorie": "Crédit Maison", "montant": 13248.0, "type": "annuel", "actif": True, "moisAttendus": [12]},
        {"id": "Vacances ski", "categorie": "Vacances ski", "montant": 2500.0, "type": "annuel", "actif": True, "moisAttendus": [2]},
        {"id": "Vacances Novembre", "categorie": "Vacances Novembre", "montant": 2275.0, "type": "annuel", "actif": True},
    ]
    recurrences = [
        {"label": "SFR", "category": "Fibre SFR", "expectedAmount": -27.47, "active": True},
        {"label": "PRET IMMOBILIER", "category": "Crédit Maison", "expectedAmount": -1103.90, "active": True},
        {"label": "Claude AI", "category": "Achats shopping autres", "expectedAmount": -22.0, "active": True},
        {"label": "Prélèvement", "category": "Crédit voiture", "expectedAmount": -369.86, "active": True},
        {"label": "Ancien abonnement", "category": "Nourriture", "expectedAmount": -700.0, "active": False},
    ]
    transactions = [
        # Charges fixes de la semaine : ne doivent pas apparaître dans le mail
        {"date": "2026-10-28", "libelle": "PRET IMMOBILIER", "montant": -1103.90, "categorie": "Crédit Maison"},
        {"date": "2026-10-29", "libelle": "Prélèvement", "montant": -11552.69, "categorie": "Crédit voiture"},
        {"date": "2026-10-27", "libelle": "SFR", "montant": -27.47, "categorie": "Fibre SFR"},
        # Budget variable Nourriture : 386,44 € ce mois, 300 € au 30/09
        {"date": "2026-10-27", "libelle": "E.leclerc", "montant": -86.44, "categorie": "Nourriture"},
        {"date": "2026-10-05", "libelle": "Courses", "montant": -300.0, "categorie": "Nourriture"},
        {"date": "2026-09-10", "libelle": "Courses", "montant": -250.0, "categorie": "Nourriture"},
        {"date": "2026-09-30", "libelle": "Courses", "montant": -50.0, "categorie": "Nourriture"},
        # Abonnement récurrent compté dans son budget variable
        {"date": "2026-10-15", "libelle": "Claude AI", "montant": -22.0, "categorie": "Achats shopping autres"},
        {"date": "2026-10-20", "libelle": "Fnac", "montant": -100.0, "categorie": "Achats shopping autres"},
        # Enveloppes
        {"date": "2026-10-30", "libelle": "Hôtel", "montant": -183.85, "categorie": "Vacances Novembre"},
        {"date": "2026-03-01", "libelle": "Acompte", "montant": -500.0, "categorie": "Vacances Novembre"},
        {"date": "2026-02-15", "libelle": "Séjour", "montant": -2000.0, "categorie": "Vacances ski"},  # cycle précédent
        {"date": "2026-10-01", "libelle": "Forfaits", "montant": -300.0, "categorie": "Vacances ski"},
    ]
    return budgets, recurrences, transactions


def test_recap_ignore_les_charges_fixes_et_suit_les_budgets_variables():
    budgets, recurrences, transactions = _recap_budgets_variables_fixture()
    data = build_weekly_recap_data(
        balances=[],
        transactions=transactions,
        budgets=budgets,
        recurrences=recurrences,
        reference_date=date(2026, 10, 31),
    )

    variables = {b["categorie"]: b for b in data["budgets"]["variables"]}
    assert set(variables) == {"Nourriture", "Achats shopping autres"}
    nourriture = variables["Nourriture"]
    assert nourriture["budget"] == 700.0
    assert round(nourriture["depense"], 2) == 386.44
    assert round(nourriture["depense_mois_precedent"], 2) == 300.0
    assert round(nourriture["ecart_mois_precedent"], 2) == 86.44
    # L'abonnement Claude AI reste compté dans la consommation du budget
    assert variables["Achats shopping autres"]["depense"] == 122.0

    envelopes = data["budgets"]["envelopes"]
    assert [e["categorie"] for e in envelopes] == ["Vacances Novembre", "Vacances ski"]
    assert round(envelopes[0]["depense"], 2) == 683.85
    assert envelopes[0]["echeance"] == "2026-12"
    assert envelopes[1]["depense"] == 300.0
    assert envelopes[1]["echeance"] == "2027-02"

    # Dépenses de la semaine : sans les charges fixes
    cats = {c["categorie"] for c in data["expenses"]["categories"]}
    assert cats == {"Nourriture", "Vacances Novembre"}
    assert round(data["expenses"]["total_expenses"], 2) == 270.29
    assert all(t["categorie"] not in {"Crédit Maison", "Crédit voiture", "Fibre SFR"} for t in data["expenses"]["top_transactions"])

    html = render_weekly_recap_html(data)
    text = render_weekly_recap_text(data)
    for body in (html, text):
        assert "Vacances Novembre" in body
        assert "Nourriture" in body
        assert "Crédit voiture" not in body
        assert "Crédit Maison" not in body
        assert "Fibre SFR" not in body
