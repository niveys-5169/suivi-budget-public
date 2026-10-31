"""
weekly_recap.py — Récapitulatif hebdomadaire (Soldes, Dépenses, Budgets)
=======================================================================

Génère et expédie par email le bilan de la semaine selon les préférences :
1. Soldes des comptes courants et statut de rapprochement (optionnel)
2. Soldes des livrets d'épargne (optionnel)
3. Dépenses des 7 derniers jours et top opérations (optionnel)
4. Budgets variables du mois (vs mois précédent à date) et enveloppes annuelles (optionnel)

Les charges fixes (catégories couvertes par des récurrences : crédits, internet,
assurances…) ne sont pas mises en avant : elles ne comptent que dans la
consommation de leur budget.

Module partagé maintenu byte-identique entre src/ et functions/.
Garde-fou : tests/test_shared_backend_sync.py échoue si les copies divergent.
"""

from __future__ import annotations

from html import escape as html_escape
import logging
from urllib.parse import quote
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set
from zoneinfo import ZoneInfo

log = logging.getLogger(__name__)

PARIS_TZ = ZoneInfo("Europe/Paris")

# Catégories de flux patrimoniaux à ignorer des calculs de dépenses
IGNORED_FLOW_CATEGORIES = {
    "virement interne",
    "virements internes",
    "epargne",
    "versement epargne",
    "versements epargne",
    "retrait epargne",
    "retraits epargne",
}


# Une catégorie est une charge fixe si ses récurrences actives couvrent au moins
# cette part de son budget mensuel (ou si elle n'a pas de budget).
FIXED_CHARGE_COVERAGE = 0.8


def normalize_category(cat: Optional[str]) -> str:
    """Normalise une catégorie pour comparaison (suppression accents, casse, espaces)."""
    if not cat:
        return ""
    s = unicodedata.normalize("NFD", str(cat))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def format_eur(amount: float) -> str:
    """Formate un montant en euros (ex: 1 234,56 €)."""
    val = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{val} €"


def _assigned_month(tx: Dict[str, Any]) -> str:
    return str(tx.get("moisAffectation") or str(tx.get("date") or "")[:7])


def _dedupe_budgets(budgets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Une fiche par catégorie, comme `dedupeBudgetsByCategory` côté app :
    financée (montant > 0) d'abord, puis ID déterministe (nom de catégorie)."""
    def score(b: Dict[str, Any]) -> int:
        cat = str(b.get("categorie") or b.get("id") or "")
        doc_key = "__enc__" + quote(cat, safe="-_.!~*'()") if "/" in cat else cat
        return (2 if float(b.get("montant") or 0) > 0 else 0) + (1 if b.get("id") == doc_key else 0)

    unique: Dict[str, Dict[str, Any]] = {}
    for b in budgets:
        key = normalize_category(b.get("categorie") or b.get("nom") or b.get("id"))
        if not key:
            continue
        current = unique.get(key)
        if current is None or score(current) <= score(b):
            unique[key] = b
    return list(unique.values())


def _envelope_cycle(mois_echeance: int, month_key: str) -> tuple:
    """Bornes (YYYY-MM, incluses) du cycle de 12 mois finissant au mois de l'échéance."""
    year, month = (int(x) for x in month_key.split("-"))
    fin_year = year if month <= mois_echeance else year + 1
    debut_month = mois_echeance % 12 + 1
    debut_year = fin_year if debut_month == 1 else fin_year - 1
    return f"{debut_year}-{debut_month:02d}", f"{fin_year}-{mois_echeance:02d}"


def build_weekly_recap_data(
    balances: List[Dict[str, Any]],
    transactions: List[Dict[str, Any]],
    budgets: List[Dict[str, Any]],
    monthly_overrides: Optional[List[Dict[str, Any]]] = None,
    excluded_categories: Optional[List[str]] = None,
    reference_date: Optional[date] = None,
    include_checking: bool = True,
    include_savings: bool = False,
    savings_balances: Optional[List[Dict[str, Any]]] = None,
    include_expenses: bool = True,
    include_budgets: bool = True,
    warning_threshold: float = 80.0,
    recurrences: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Construit les données structurées du récapitulatif hebdomadaire.
    Fonction pure et déterministe, facilitant les tests unitaires.
    """
    if reference_date is None:
        reference_date = datetime.now(timezone.utc).date()

    week_end = reference_date
    week_start = reference_date - timedelta(days=6)
    week_start_str = week_start.strftime("%Y-%m-%d")
    week_end_str = week_end.strftime("%Y-%m-%d")

    current_month_key = reference_date.strftime("%Y-%m")

    # Catégories exclues
    excluded_set: Set[str] = set(IGNORED_FLOW_CATEGORIES)
    if excluded_categories:
        for c in excluded_categories:
            excluded_set.add(normalize_category(c))

    # 1. Soldes des comptes courants
    checking_accounts = []
    total_checking_balance = 0.0

    if include_checking:
        for b in balances:
            if b.get("is_savings") is True:
                continue
            raw_solde = b.get("current_balance")
            if raw_solde is None:
                raw_solde = b.get("solde", 0.0)
            solde = float(raw_solde)
            total_checking_balance += solde

            compte = str(b.get("compte") or b.get("id") or "Compte")
            status = str(b.get("status", "UNKNOWN")).lower()
            ecart = b.get("ecart")
            ecart_val = float(ecart) if ecart is not None else None

            if status == "reconciled":
                status_label = "Rapproché"
                status_tone = "positive"
            elif status in ("pending_review", "discrepancy_unresolved"):
                status_label = "Écart à vérifier"
                status_tone = "warning" if (ecart_val is not None and abs(ecart_val) < 50) else "negative"
            else:
                status_label = "À vérifier"
                status_tone = "neutral"

            checking_accounts.append({
                "compte": compte,
                "solde": solde,
                "status": status,
                "status_label": status_label,
                "status_tone": status_tone,
                "ecart": ecart_val,
            })
        checking_accounts.sort(key=lambda a: a["solde"], reverse=True)

    # 1b. Soldes des comptes d'épargne (optionnel)
    savings_accounts = []
    total_savings_balance = 0.0
    if include_savings and savings_balances:
        for s in savings_balances:
            raw_solde = s.get("current_balance")
            if raw_solde is None:
                raw_solde = s.get("solde", 0.0)
            solde = float(raw_solde)
            total_savings_balance += solde
            savings_accounts.append({
                "compte": str(s.get("compte") or s.get("id") or "Épargne"),
                "solde": solde,
            })
        savings_accounts.sort(key=lambda a: a["solde"], reverse=True)

    # Budgets du mois (montant mensuel effectif) et charges fixes
    monthly_overrides_map: Dict[str, float] = {}
    for mo in monthly_overrides or []:
        m = str(mo.get("mois") or mo.get("month") or "")
        if m == current_month_key:
            c_norm = normalize_category(mo.get("categorie") or mo.get("id"))
            if c_norm and "budget" in mo:
                monthly_overrides_map[c_norm] = float(mo["budget"])
            elif c_norm and "montant" in mo:
                monthly_overrides_map[c_norm] = float(mo["montant"])

    expense_budgets: Dict[str, Dict[str, Any]] = {}
    for b in _dedupe_budgets(budgets):
        if b.get("actif") is False or b.get("isIncome") is True or b.get("type") == "revenu":
            continue
        norm_cat = normalize_category(b.get("categorie") or b.get("nom") or b.get("id"))
        if norm_cat in excluded_set:
            continue
        is_envelope = b.get("type") == "annuel"
        if is_envelope:
            monthly_amount = float(b.get("montant", 0.0)) / 12
        else:
            monthly_amount = monthly_overrides_map.get(norm_cat, float(b.get("montant", 0.0)))
        expense_budgets[norm_cat] = {"budget": b, "envelope": is_envelope, "monthly": monthly_amount}

    recurring_by_cat: Dict[str, float] = {}
    for r in recurrences or []:
        if r.get("active") is False:
            continue
        c_norm = normalize_category(r.get("category"))
        recurring_by_cat[c_norm] = recurring_by_cat.get(c_norm, 0.0) + abs(float(r.get("expectedAmount") or 0.0))

    fixed_cats: Set[str] = set()
    for c_norm, recurring in recurring_by_cat.items():
        eb = expense_budgets.get(c_norm)
        if eb is None or (eb["monthly"] > 0 and recurring >= FIXED_CHARGE_COVERAGE * eb["monthly"]):
            fixed_cats.add(c_norm)

    # 2. Dépenses variables de la semaine (7 derniers jours, hors charges fixes)
    weekly_expenses_by_cat: Dict[str, float] = {}
    weekly_expenses_txs: List[Dict[str, Any]] = []
    total_weekly_expenses = 0.0
    total_weekly_income = 0.0

    if include_expenses:
        for tx in transactions:
            if tx.get("bankStatus") == "cancelled":
                continue
            tx_date = str(tx.get("date") or "")
            if not (week_start_str <= tx_date <= week_end_str):
                continue

            raw_cat = str(tx.get("categorie") or "Non catégorisé").strip()
            norm_cat = normalize_category(raw_cat)
            if norm_cat in excluded_set or norm_cat in fixed_cats:
                continue

            montant = float(tx.get("montant", 0.0))
            if montant < 0:
                spent = abs(montant)
                total_weekly_expenses += spent
                weekly_expenses_by_cat[raw_cat] = weekly_expenses_by_cat.get(raw_cat, 0.0) + spent
                weekly_expenses_txs.append({
                    "date": tx_date,
                    "libelle": str(tx.get("libelle") or "Sans libellé").strip(),
                    "montant": spent,
                    "categorie": raw_cat,
                    "compte": str(tx.get("compte") or ""),
                })
            elif montant > 0:
                total_weekly_income += montant

        weekly_expenses_txs.sort(key=lambda t: t["montant"], reverse=True)

    top_expenses = weekly_expenses_txs[:5]

    category_breakdown = [
        {
            "categorie": cat,
            "montant": amt,
            "pourcentage": round((amt / total_weekly_expenses * 100), 1) if total_weekly_expenses > 0 else 0.0,
        }
        for cat, amt in weekly_expenses_by_cat.items()
    ]
    category_breakdown.sort(key=lambda c: c["montant"], reverse=True)

    # 3. Budgets variables du mois (vs mois précédent à date) et enveloppes annuelles
    variable_budgets: List[Dict[str, Any]] = []
    exceeded_budgets: List[Dict[str, Any]] = []
    warning_budgets: List[Dict[str, Any]] = []
    envelopes: List[Dict[str, Any]] = []

    if include_budgets:
        prev_month_last_day = reference_date.replace(day=1) - timedelta(days=1)
        prev_month_key = prev_month_last_day.strftime("%Y-%m")
        prev_cutoff = prev_month_last_day.replace(day=min(reference_date.day, prev_month_last_day.day)).strftime("%Y-%m-%d")

        current_month_net: Dict[str, float] = {}
        prev_month_net: Dict[str, float] = {}
        net_by_cat_month: Dict[str, Dict[str, float]] = {}
        for tx in transactions:
            if tx.get("bankStatus") == "cancelled":
                continue
            norm_cat = normalize_category(str(tx.get("categorie") or "Non catégorisé").strip())
            if norm_cat not in expense_budgets:
                continue
            tx_month = _assigned_month(tx)
            montant = float(tx.get("montant", 0.0))
            by_month = net_by_cat_month.setdefault(norm_cat, {})
            by_month[tx_month] = by_month.get(tx_month, 0.0) + montant
            if tx_month == current_month_key:
                current_month_net[norm_cat] = current_month_net.get(norm_cat, 0.0) + montant
            elif tx_month == prev_month_key and str(tx.get("date") or "") <= prev_cutoff:
                prev_month_net[norm_cat] = prev_month_net.get(norm_cat, 0.0) + montant

        for norm_cat, eb in expense_budgets.items():
            if norm_cat in fixed_cats:
                continue
            b = eb["budget"]
            raw_cat = str(b.get("categorie") or b.get("nom") or b.get("id") or "")

            if eb["envelope"]:
                montant = float(b.get("montant", 0.0))
                if montant <= 0:
                    continue
                mois_attendus = [int(m) for m in (b.get("moisAttendus") or [])]
                debut, fin = _envelope_cycle(max(mois_attendus) if mois_attendus else 12, current_month_key)
                net = sum(v for m, v in net_by_cat_month.get(norm_cat, {}).items() if debut <= m <= fin)
                depense = 0.0 - net  # évite « -0,00 € »
                envelopes.append({
                    "categorie": raw_cat,
                    "budget": montant,
                    "depense": depense,
                    "reste": round(montant - depense, 2),
                    "pourcentage": round(depense / montant * 100, 1),
                    "echeance": fin,
                })
                continue

            budget_amount = eb["monthly"]
            if budget_amount <= 0:
                continue
            spent = max(0.0, -current_month_net.get(norm_cat, 0.0))
            prev_spent = max(0.0, -prev_month_net.get(norm_cat, 0.0))
            pct = round((spent / budget_amount) * 100, 1)
            budget_item = {
                "categorie": raw_cat,
                "budget": budget_amount,
                "depense": spent,
                "pourcentage": pct,
                "depassement": round(spent - budget_amount, 2),
                "reste": round(budget_amount - spent, 2),
                "depense_mois_precedent": prev_spent,
                "ecart_mois_precedent": round(spent - prev_spent, 2),
            }
            variable_budgets.append(budget_item)
            if pct > 100.0:
                exceeded_budgets.append(budget_item)
            elif pct >= warning_threshold:
                warning_budgets.append(budget_item)

        variable_budgets.sort(key=lambda b: b["pourcentage"], reverse=True)
        exceeded_budgets.sort(key=lambda b: b["depassement"], reverse=True)
        warning_budgets.sort(key=lambda b: b["pourcentage"], reverse=True)
        envelopes.sort(key=lambda e: (e["echeance"], e["categorie"]))

    return {
        "period": {
            "start": week_start_str,
            "end": week_end_str,
            "month": current_month_key,
        },
        "options": {
            "include_checking": include_checking,
            "include_savings": include_savings,
            "include_expenses": include_expenses,
            "include_budgets": include_budgets,
            "warning_threshold": warning_threshold,
        },
        "balances": {
            "accounts": checking_accounts,
            "total": total_checking_balance,
            "savings_accounts": savings_accounts,
            "total_savings": total_savings_balance,
        },
        "expenses": {
            "total_expenses": total_weekly_expenses,
            "total_income": total_weekly_income,
            "net": total_weekly_income - total_weekly_expenses,
            "categories": category_breakdown,
            "top_transactions": top_expenses,
        },
        "budgets": {
            "variables": variable_budgets,
            "exceeded": exceeded_budgets,
            "warning": warning_budgets,
            "envelopes": envelopes,
        },
    }


def render_weekly_recap_html(data: Dict[str, Any]) -> str:
    """Génère le corps HTML de l'email avec le Design System AURUM."""
    p_start = data["period"]["start"].split("-")[::-1]
    p_end = data["period"]["end"].split("-")[::-1]
    period_str = f"Du {'/'.join(p_start)} au {'/'.join(p_end)}"

    opts = data.get("options", {})
    include_checking = opts.get("include_checking", True)
    include_savings = opts.get("include_savings", False)
    include_expenses = opts.get("include_expenses", True)
    include_budgets = opts.get("include_budgets", True)
    warning_threshold = opts.get("warning_threshold", 80.0)

    _esc = lambda v: html_escape(str(v or ""))

    # 1. Section Soldes des comptes courants
    checking_section_html = ""
    if include_checking and data["balances"]["accounts"]:
        total_solde = format_eur(data["balances"]["total"])
        accounts_rows = ""
        for acc in data["balances"]["accounts"]:
            tone_color = "#10B981" if acc["status_tone"] == "positive" else ("#F59E0B" if acc["status_tone"] == "warning" else "#EF4444")
            ecart_str = f" ({format_eur(acc['ecart'])})" if acc.get("ecart") is not None else ""
            accounts_rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 10px 0; color: #F5F5F7; font-size: 14px;">{_esc(acc['compte'])}</td>
              <td style="padding: 10px 0; text-align: right; color: #F5F5F7; font-size: 14px; font-weight: 600;">{format_eur(acc['solde'])}</td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="font-size: 11px; padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,0.05); color: {tone_color};">
                  {_esc(acc['status_label'])}{ecart_str}
                </span>
              </td>
            </tr>
            """
        checking_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Solde total comptes courants</div>
          <div style="color: #D4AF37; font-size: 30px; font-weight: 700; margin-bottom: 14px;">{total_solde}</div>
          <table style="width: 100%; border-collapse: collapse;">
            {accounts_rows}
          </table>
        </div>
        """

    # 1b. Section Livrets d'épargne
    savings_section_html = ""
    if include_savings and data["balances"].get("savings_accounts"):
        total_savings = format_eur(data["balances"]["total_savings"])
        savings_rows = ""
        for s in data["balances"]["savings_accounts"]:
            savings_rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">{_esc(s['compte'])}</td>
              <td style="padding: 8px 0; text-align: right; color: #F5F5F7; font-size: 13px; font-weight: 600;">{format_eur(s['solde'])}</td>
            </tr>
            """
        savings_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Épargne & Livrets ({total_savings})</div>
          <table style="width: 100%; border-collapse: collapse;">
            {savings_rows}
          </table>
        </div>
        """

    # 2. Section Dépenses de la semaine
    expenses_section_html = ""
    if include_expenses:
        total_depenses = format_eur(data["expenses"]["total_expenses"])
        cat_rows = ""
        for cat in data["expenses"]["categories"][:5]:
            cat_rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">{_esc(cat['categorie'])}</td>
              <td style="padding: 8px 0; text-align: right; color: #9E9EA7; font-size: 12px;">{cat['pourcentage']}%</td>
              <td style="padding: 8px 0; text-align: right; color: #F5F5F7; font-size: 13px; font-weight: 600;">{format_eur(cat['montant'])}</td>
            </tr>
            """

        top_tx_rows = ""
        for tx in data["expenses"]["top_transactions"]:
            d_fr = "/".join(tx["date"].split("-")[::-1][:2])
            top_tx_rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 0; color: #9E9EA7; font-size: 12px; width: 45px;">{d_fr}</td>
              <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">
                {_esc(tx['libelle'])}
                <div style="font-size: 11px; color: #9E9EA7;">{_esc(tx['categorie'])}</div>
              </td>
              <td style="padding: 8px 0; text-align: right; color: #EF4444; font-size: 13px; font-weight: 600;">
                -{format_eur(tx['montant'])}
              </td>
            </tr>
            """

        expenses_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Dépenses variables des 7 derniers jours</div>
          <div style="color: #F5F5F7; font-size: 24px; font-weight: 600; margin-bottom: 14px;">{total_depenses}</div>
          
          {f'''
          <div style="margin-bottom: 16px;">
            <div style="color: #9E9EA7; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Catégories principales</div>
            <table style="width: 100%; border-collapse: collapse;">
              {cat_rows}
            </table>
          </div>
          ''' if cat_rows else ''}

          {f'''
          <div>
            <div style="color: #9E9EA7; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Plus grosses opérations</div>
            <table style="width: 100%; border-collapse: collapse;">
              {top_tx_rows}
            </table>
          </div>
          ''' if top_tx_rows else ''}
        </div>
        """

    # 3. Section Budgets variables + Enveloppes
    budgets_section_html = ""
    envelopes_section_html = ""
    if include_budgets:
        variables = data["budgets"]["variables"]
        rows = ""
        for b in variables:
            if b["pourcentage"] > 100.0:
                tone = "#EF4444"
            elif b["pourcentage"] >= warning_threshold:
                tone = "#F59E0B"
            else:
                tone = "#10B981"
            details = f"reste {format_eur(b['reste'])}" if b["reste"] >= 0 else f"dépassé de {format_eur(b['depassement'])}"
            if "depense_mois_precedent" in b:
                ecart = b["ecart_mois_precedent"]
                ecart_str = f"+{format_eur(ecart)}" if ecart >= 0 else f"-{format_eur(-ecart)}"
                details += f" · M-1 à date : {format_eur(b['depense_mois_precedent'])} ({ecart_str})"
            rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">
                {_esc(b['categorie'])}
                <div style="font-size: 11px; color: #9E9EA7;">{_esc(details)}</div>
              </td>
              <td style="padding: 8px 0; text-align: right; color: #9E9EA7; font-size: 12px;">{format_eur(b['depense'])} / {format_eur(b['budget'])}</td>
              <td style="padding: 8px 0; text-align: right; color: {tone}; font-size: 13px; font-weight: 600;">{b['pourcentage']}%</td>
            </tr>
            """

        n_exceeded = len(data["budgets"]["exceeded"])
        n_warning = len(data["budgets"]["warning"])
        if n_exceeded or n_warning:
            summary = f"⚠️ {n_exceeded} dépassé(s) · ⚡ {n_warning} sous tension (≥ {warning_threshold:.0f} %)"
            summary_color = "#EF4444" if n_exceeded else "#F59E0B"
        else:
            summary = "✨ Tous vos budgets variables sont sous contrôle ce mois-ci !"
            summary_color = "#10B981"

        budgets_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Budgets variables du mois</div>
          <div style="color: {summary_color}; font-size: 13px; margin-bottom: 10px;">{summary}</div>
          {f'<table style="width: 100%; border-collapse: collapse;">{rows}</table>' if rows else ''}
        </div>
        """

        env_rows = ""
        for e in data["budgets"].get("envelopes", []):
            y, m = e["echeance"].split("-")
            reste_color = "#EF4444" if e["reste"] < 0 else "#F5F5F7"
            env_rows += f"""
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">
                {_esc(e['categorie'])}
                <div style="font-size: 11px; color: #9E9EA7;">échéance {m}/{y} · {format_eur(e['depense'])} / {format_eur(e['budget'])}</div>
              </td>
              <td style="padding: 8px 0; text-align: right; color: {reste_color}; font-size: 13px; font-weight: 600;">
                reste {format_eur(e['reste'])}
              </td>
            </tr>
            """
        if env_rows:
            envelopes_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Enveloppes annuelles</div>
          <table style="width: 100%; border-collapse: collapse;">
            {env_rows}
          </table>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Récapitulatif hebdomadaire — Suivi-Budget</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #0B0B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F5F5F7;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #15151F; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; box-sizing: border-box;">
    
    <!-- Header -->
    <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px; margin-bottom: 20px;">
      <div style="color: #D4AF37; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">Suivi-Budget • Privé</div>
      <h1 style="color: #F5F5F7; font-size: 22px; font-weight: 600; margin: 6px 0 2px 0;">Bilan de la semaine</h1>
      <div style="color: #9E9EA7; font-size: 13px;">{period_str}</div>
    </div>

    <!-- Sections configurées -->
    {checking_section_html}
    {savings_section_html}
    {budgets_section_html}
    {envelopes_section_html}
    {expenses_section_html}

    <!-- Footer -->
    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; text-align: center; color: #9E9EA7; font-size: 12px;">
      Généré automatiquement par Suivi-Budget.
    </div>

  </div>
</body>
</html>
"""
    return html


def render_weekly_recap_text(data: Dict[str, Any]) -> str:
    """Génère la version texte brut de l'email."""
    opts = data.get("options", {})
    include_checking = opts.get("include_checking", True)
    include_savings = opts.get("include_savings", False)
    include_expenses = opts.get("include_expenses", True)
    include_budgets = opts.get("include_budgets", True)

    lines = [
        "SUIVI-BUDGET — BILAN DE LA SEMAINE",
        f"Période : {data['period']['start']} au {data['period']['end']}",
        "=" * 40,
    ]

    if include_checking and data["balances"]["accounts"]:
        lines.append("")
        lines.append(f"SOLDES COMPTES COURANTS : {format_eur(data['balances']['total'])}")
        for acc in data["balances"]["accounts"]:
            lines.append(f"  - {acc['compte']} : {format_eur(acc['solde'])} ({acc['status_label']})")

    if include_savings and data["balances"].get("savings_accounts"):
        lines.append("")
        lines.append(f"ÉPARGNE & LIVRETS : {format_eur(data['balances']['total_savings'])}")
        for s in data["balances"]["savings_accounts"]:
            lines.append(f"  - {s['compte']} : {format_eur(s['solde'])}")

    if include_budgets:
        lines.append("")
        lines.append("BUDGETS VARIABLES DU MOIS :")
        variables = data["budgets"]["variables"]
        if not data["budgets"]["exceeded"] and not data["budgets"]["warning"]:
            lines.append("✨ Tous vos budgets variables sont sous contrôle !")
        for b in variables:
            flag = "⚠️ " if b["pourcentage"] > 100.0 else ("⚡ " if b in data["budgets"]["warning"] else "")
            line = f"  - {flag}{b['categorie']} : {format_eur(b['depense'])} / {format_eur(b['budget'])} ({b['pourcentage']}%)"
            if "depense_mois_precedent" in b:
                ecart = b["ecart_mois_precedent"]
                ecart_str = f"+{format_eur(ecart)}" if ecart >= 0 else f"-{format_eur(-ecart)}"
                line += f" | M-1 à date : {format_eur(b['depense_mois_precedent'])} ({ecart_str})"
            lines.append(line)

        if data["budgets"].get("envelopes"):
            lines.append("")
            lines.append("ENVELOPPES ANNUELLES :")
            for e in data["budgets"]["envelopes"]:
                y, m = e["echeance"].split("-")
                lines.append(f"  - {e['categorie']} (échéance {m}/{y}) : {format_eur(e['depense'])} / {format_eur(e['budget'])}, reste {format_eur(e['reste'])}")

    if include_expenses:
        lines.append("")
        lines.append(f"DÉPENSES VARIABLES 7 DERNIERS JOURS : {format_eur(data['expenses']['total_expenses'])}")
        if data["expenses"]["categories"]:
            lines.append("Catégories principales :")
            for cat in data["expenses"]["categories"][:5]:
                lines.append(f"  - {cat['categorie']} : {format_eur(cat['montant'])} ({cat['pourcentage']}%)")

        if data["expenses"]["top_transactions"]:
            lines.append("Top dépenses :")
            for tx in data["expenses"]["top_transactions"]:
                lines.append(f"  - {tx['date']} | {tx['libelle']} : -{format_eur(tx['montant'])}")

    return "\n".join(lines)


def run_weekly_recap(
    db: Any,
    gmail: Any,
    force: bool = False,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Exécute le flux complet :
    1. Vérifie si l'envoi est activé (config/weekly_report)
    2. Récupère les données Firestore selon les options configurées
    3. Génère l'email HTML/texte
    4. Envoie le message via GmailClient
    5. Met à jour les métadonnées de dernier envoi
    """
    now_utc = now or datetime.now(timezone.utc)
    config_ref = db.collection("config").document("weekly_report")
    config_snap = config_ref.get()
    config_data = config_snap.to_dict() or {} if config_snap.exists else {}

    is_enabled = config_data.get("enabled", True)
    if not is_enabled and not force:
        log.info("Récapitulatif hebdomadaire désactivé dans la configuration — envoi ignoré.")
        return {"status": "skipped", "reason": "disabled"}

    # Options configurables
    include_checking = config_data.get("includeCheckingBalances", True)
    include_savings = config_data.get("includeSavingsBalances", False)
    include_expenses = config_data.get("includeWeeklyExpenses", True)
    include_budgets = config_data.get("includeBudgetAlerts", True)
    warning_threshold = float(config_data.get("budgetWarningThreshold", 80.0))

    # Destinataires
    recipients = config_data.get("recipients", [])
    if isinstance(recipients, str):
        recipients = [r.strip() for r in recipients.split(",") if r.strip()]
    elif isinstance(recipients, list):
        recipients = [str(r).strip() for r in recipients if str(r).strip()]
    else:
        recipients = []

    if not recipients:
        profile_email = gmail.get_profile_email()
        if profile_email:
            recipients = [profile_email]
        else:
            raise RuntimeError("Impossible de déterminer le destinataire de l'email récapitulatif.")

    # Chargement Firestore
    balances = []
    if include_checking:
        balances = [doc.to_dict() or {} for doc in db.collection("account_balances").stream()]

    savings_balances = []
    if include_savings:
        savings_balances = [doc.to_dict() or {} for doc in db.collection("savings_balances").stream()]

    # Transactions : 13 mois pour couvrir la semaine, le mois précédent et le cycle des enveloppes
    transactions = []
    if include_expenses or include_budgets:
        cutoff = (now_utc - timedelta(days=400)).strftime("%Y-%m-%d")
        tx_stream = db.collection("transactions").where("date", ">=", cutoff).stream()
        transactions = [doc.to_dict() or {} for doc in tx_stream]

    budgets = []
    monthly_overrides = []
    recurrences = []
    if include_expenses or include_budgets:
        budgets = [{**(doc.to_dict() or {}), "id": doc.id} for doc in db.collection("budgets").stream()]
        monthly_overrides = [doc.to_dict() or {} for doc in db.collection("budgets_monthly").stream()]
        recurrences = [doc.to_dict() or {} for doc in db.collection("recurrences").stream()]

    excluded_categories = []
    ex_doc = db.collection("metadata").document("budget_excluded_categories").get()
    if ex_doc.exists:
        data = ex_doc.to_dict() or {}
        if isinstance(data.get("categories"), list):
            excluded_categories = data["categories"]

    # Construction des données
    data = build_weekly_recap_data(
        balances=balances,
        transactions=transactions,
        budgets=budgets,
        monthly_overrides=monthly_overrides,
        excluded_categories=excluded_categories,
        reference_date=now_utc.astimezone(PARIS_TZ).date(),
        include_checking=include_checking,
        include_savings=include_savings,
        savings_balances=savings_balances,
        include_expenses=include_expenses,
        include_budgets=include_budgets,
        warning_threshold=warning_threshold,
        recurrences=recurrences,
    )

    html_body = render_weekly_recap_html(data)
    text_body = render_weekly_recap_text(data)

    subject = f"📊 Récapitulatif de la semaine — {data['period']['end']}"

    try:
        msg_id = gmail.send_html_email(
            to_emails=recipients,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )
        log.info(f"Email récapitulatif hebdomadaire envoyé avec succès ({msg_id}) à {recipients}.")

        config_ref.set({
            "lastSentAt": now_utc,
            "lastStatus": "success",
            "lastError": None,
            "lastRecipients": recipients,
            "updatedAt": now_utc,
        }, merge=True)

        return {
            "status": "success",
            "messageId": msg_id,
            "recipients": recipients,
            "data": data,
        }
    except Exception as e:
        log.exception("Erreur lors de l'envoi de l'email récapitulatif hebdomadaire")
        config_ref.set({
            "lastStatus": "error",
            "lastError": str(e),
            "updatedAt": now_utc,
        }, merge=True)
        raise


def check_and_run_scheduled_weekly_recap(
    db: Any,
    gmail: Any,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Vérifie si l'heure courante (Europe/Paris) correspond au jour et à l'heure
    configurés dans Firestore (config/weekly_report).
    Si oui, et que l'envoi n'a pas déjà eu lieu aujourd'hui, déclenche le récapitulatif.
    """
    now_dt = now or datetime.now(timezone.utc)
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)
    now_paris = now_dt.astimezone(PARIS_TZ)

    config_ref = db.collection("config").document("weekly_report")
    config_snap = config_ref.get()
    config_data = config_snap.to_dict() or {} if config_snap.exists else {}

    if not config_data.get("enabled", True):
        log.info("check_and_run_scheduled_weekly_recap: envoi désactivé.")
        return {"status": "skipped", "reason": "disabled"}

    target_day = int(config_data.get("dayOfWeek", 5))  # 1 = Lundi, 5 = Vendredi, 7 = Dimanche
    target_hour = int(config_data.get("sendHour", 18))  # 18h par défaut

    current_day = now_paris.isoweekday()
    current_hour = now_paris.hour

    if current_day != target_day or current_hour != target_hour:
        log.debug(
            f"check_and_run_scheduled_weekly_recap: pas l'heure configurée "
            f"(actuel: jour={current_day}, h={current_hour} vs cible: jour={target_day}, h={target_hour})."
        )
        return {
            "status": "skipped",
            "reason": "schedule_mismatch",
            "current": {"day": current_day, "hour": current_hour},
            "target": {"day": target_day, "hour": target_hour},
        }

    # Vérifie si un envoi a déjà réussi aujourd'hui pour éviter un doublon
    last_sent_at = config_data.get("lastSentAt")
    if last_sent_at:
        if isinstance(last_sent_at, datetime):
            last_sent_paris = last_sent_at.astimezone(PARIS_TZ)
            if last_sent_paris.date() == now_paris.date():
                log.info("check_and_run_scheduled_weekly_recap: email déjà envoyé aujourd'hui.")
                return {"status": "skipped", "reason": "already_sent_today"}

    log.info(f"check_and_run_scheduled_weekly_recap: jour {current_day} heure {current_hour}h -> lancement de l'envoi.")
    return run_weekly_recap(db, gmail, force=False, now=now_dt)
