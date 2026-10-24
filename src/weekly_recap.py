"""
weekly_recap.py — Récapitulatif hebdomadaire (Soldes, Dépenses, Budgets)
=======================================================================

Génère et expédie par email le bilan de la semaine selon les préférences :
1. Soldes des comptes courants et statut de rapprochement (optionnel)
2. Soldes des livrets d'épargne (optionnel)
3. Dépenses des 7 derniers jours et top opérations (optionnel)
4. Budgets du mois en cours dépassés (> 100 %) ou sous tension (≥ seuil) (optionnel)

Module partagé maintenu byte-identique entre src/ et functions/.
Garde-fou : tests/test_shared_backend_sync.py échoue si les copies divergent.
"""

from __future__ import annotations

from html import escape as html_escape
import logging
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

    # 2. Dépenses de la semaine (7 derniers jours)
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
            if norm_cat in excluded_set:
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

    # 3. Budgets mensuels dépassés (>100%) ou sous tension (≥ seuil)
    exceeded_budgets: List[Dict[str, Any]] = []
    warning_budgets: List[Dict[str, Any]] = []

    if include_budgets:
        current_month_net: Dict[str, float] = {}
        for tx in transactions:
            if tx.get("bankStatus") == "cancelled":
                continue
            tx_month = str(tx.get("moisAffectation") or tx.get("date", "")[:7])
            if tx_month != current_month_key:
                continue
            raw_cat = str(tx.get("categorie") or "Non catégorisé").strip()
            norm_cat = normalize_category(raw_cat)
            if norm_cat in excluded_set:
                continue
            montant = float(tx.get("montant", 0.0))
            current_month_net[norm_cat] = current_month_net.get(norm_cat, 0.0) + montant

        monthly_overrides_map: Dict[str, float] = {}
        if monthly_overrides:
            for mo in monthly_overrides:
                m = str(mo.get("mois") or mo.get("month") or "")
                if m == current_month_key:
                    c_norm = normalize_category(mo.get("categorie") or mo.get("id"))
                    if c_norm and "budget" in mo:
                        monthly_overrides_map[c_norm] = float(mo["budget"])
                    elif c_norm and "montant" in mo:
                        monthly_overrides_map[c_norm] = float(mo["montant"])

        seen_budget_keys: Set[str] = set()

        for b in budgets:
            if b.get("actif") is False:
                continue
            if b.get("isIncome") is True or b.get("type") == "revenu":
                continue
            if b.get("type") == "annuel":
                continue

            raw_cat = str(b.get("categorie") or b.get("nom") or b.get("id") or "")
            norm_cat = normalize_category(raw_cat)
            if not norm_cat or norm_cat in seen_budget_keys or norm_cat in excluded_set:
                continue
            seen_budget_keys.add(norm_cat)

            if norm_cat in monthly_overrides_map:
                budget_amount = monthly_overrides_map[norm_cat]
            else:
                budget_amount = float(b.get("montant", 0.0))

            if budget_amount <= 0:
                continue

            net_flow = current_month_net.get(norm_cat, 0.0)
            spent = max(0.0, -net_flow)
            pct = round((spent / budget_amount) * 100, 1)

            budget_item = {
                "categorie": raw_cat,
                "budget": budget_amount,
                "depense": spent,
                "pourcentage": pct,
                "depassement": round(spent - budget_amount, 2),
                "reste": round(budget_amount - spent, 2),
            }

            if pct > 100.0:
                exceeded_budgets.append(budget_item)
            elif pct >= warning_threshold:
                warning_budgets.append(budget_item)

        exceeded_budgets.sort(key=lambda b: b["depassement"], reverse=True)
        warning_budgets.sort(key=lambda b: b["pourcentage"], reverse=True)

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
            "exceeded": exceeded_budgets,
            "warning": warning_budgets,
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
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Dépenses des 7 derniers jours</div>
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

    # 3. Section Budgets
    budgets_section_html = ""
    if include_budgets:
        exceeded_html = ""
        if data["budgets"]["exceeded"]:
            rows = ""
            for b in data["budgets"]["exceeded"]:
                rows += f"""
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">{_esc(b['categorie'])}</td>
                  <td style="padding: 8px 0; text-align: right; color: #9E9EA7; font-size: 12px;">{format_eur(b['depense'])} / {format_eur(b['budget'])}</td>
                  <td style="padding: 8px 0; text-align: right; color: #EF4444; font-size: 13px; font-weight: 600;">
                    +{format_eur(b['depassement'])} ({b['pourcentage']}%)
                  </td>
                </tr>
                """
            exceeded_html = f"""
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
              <div style="color: #EF4444; font-weight: 600; font-size: 14px; margin-bottom: 10px;">⚠️ Budgets dépassés ce mois</div>
              <table style="width: 100%; border-collapse: collapse;">
                {rows}
              </table>
            </div>
            """

        warning_html = ""
        if data["budgets"]["warning"]:
            rows = ""
            for b in data["budgets"]["warning"]:
                rows += f"""
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <td style="padding: 8px 0; color: #F5F5F7; font-size: 13px;">{_esc(b['categorie'])}</td>
                  <td style="padding: 8px 0; text-align: right; color: #9E9EA7; font-size: 12px;">reste {format_eur(b['reste'])}</td>
                  <td style="padding: 8px 0; text-align: right; color: #F59E0B; font-size: 13px; font-weight: 600;">{b['pourcentage']}%</td>
                </tr>
                """
            warning_html = f"""
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
              <div style="color: #F59E0B; font-weight: 600; font-size: 14px; margin-bottom: 10px;">⚡ Budgets sous tension (≥ {warning_threshold:.0f} %)</div>
              <table style="width: 100%; border-collapse: collapse;">
                {rows}
              </table>
            </div>
            """

        if not data["budgets"]["exceeded"] and not data["budgets"]["warning"]:
            budget_status_box = """
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; color: #10B981; font-size: 13px;">
              ✨ Tous vos budgets sont sous contrôle ce mois-ci !
            </div>
            """
        else:
            budget_status_box = exceeded_html + warning_html

        budgets_section_html = f"""
        <div style="margin-bottom: 24px;">
          <div style="color: #9E9EA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Alertes Budgets</div>
          {budget_status_box}
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
        lines.append("BUDGETS DU MOIS :")
        if data["budgets"]["exceeded"]:
            lines.append("⚠️ Budgets dépassés :")
            for b in data["budgets"]["exceeded"]:
                lines.append(f"  - {b['categorie']} : {format_eur(b['depense'])} / {format_eur(b['budget'])} (+{format_eur(b['depassement'])}, {b['pourcentage']}%)")
        elif data["budgets"]["warning"]:
            lines.append(f"⚡ Budgets sous tension (≥ {opts.get('warning_threshold', 80):.0f} %) :")
            for b in data["budgets"]["warning"]:
                lines.append(f"  - {b['categorie']} : {b['pourcentage']}% consommé (reste {format_eur(b['reste'])})")
        else:
            lines.append("✨ Tous vos budgets sont sous contrôle !")

    if include_expenses:
        lines.append("")
        lines.append(f"DÉPENSES 7 DERNIERS JOURS : {format_eur(data['expenses']['total_expenses'])}")
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

    # Transactions : 45 derniers jours pour couvrir la semaine + le mois courant
    transactions = []
    if include_expenses or include_budgets:
        cutoff = (now_utc - timedelta(days=45)).strftime("%Y-%m-%d")
        tx_stream = db.collection("transactions").where("date", ">=", cutoff).stream()
        transactions = [doc.to_dict() or {} for doc in tx_stream]

    budgets = []
    monthly_overrides = []
    if include_budgets:
        budgets = [doc.to_dict() or {} for doc in db.collection("budgets").stream()]
        monthly_overrides = [doc.to_dict() or {} for doc in db.collection("budgets_monthly").stream()]

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
