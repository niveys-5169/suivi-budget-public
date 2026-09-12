"""
budgets_manager.py — Gestion des budgets (V2)
==============================================
"""

import logging
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from calendar import monthrange

from firebase_db import (
    add_budget,
    get_budget_by_id,
    update_budget_doc,
    delete_budget_doc,
    query_budgets,
    get_transactions_by_category_period,
    get_consumption_cache,
    set_consumption_cache,
    delete_consumption_cache,
)

log = logging.getLogger(__name__)

def create_budget(db, budget_data: Dict[str, Any]) -> str:
    """
    Crée un budget, valide les règles, retourne l'id.
    
    Rules:
    - montant > 0
    - if type=mensuel -> periode.type="mois_courant"
    - if type=annuel -> periode.type in ["annee_civile", "annee_glissante"]
    - if type=ponctuel -> periode.type="custom" with debut/fin
    """
    _validate_budget_data(budget_data)
    return add_budget(db, budget_data)


def update_budget(db, budget_id: str, updates: Dict[str, Any]) -> None:
    """Met à jour un budget, invalide le cache lié."""
    if "type" in updates or "montant" in updates or "periode" in updates or "categorie" in updates:
        # On pourrait être plus fin sur la validation des updates partielles
        # Pour simplifier, on récupère le budget complet pour valider
        current = get_budget_by_id(db, budget_id)
        if not current:
            raise ValueError(f"Budget {budget_id} introuvable")
        full_data = {**current, **updates}
        _validate_budget_data(full_data)
        
        # Invalider le cache car les règles de calcul ont changé
        delete_consumption_cache(budget_id)
    
    update_budget_doc(db, budget_id, updates)


def delete_budget(db, budget_id: str) -> None:
    """Supprime un budget et son cache de consommation."""
    delete_consumption_cache(budget_id)
    delete_budget_doc(db, budget_id)


def list_budgets(db, actif_only: bool = True) -> List[Dict[str, Any]]:
    """Liste tous les budgets."""
    filters = {"actif": True} if actif_only else None
    return query_budgets(db, filters)


def get_budget(db, budget_id: str) -> Optional[Dict[str, Any]]:
    """Récupère un budget par id."""
    return get_budget_by_id(db, budget_id)


def compute_consumption(db, budget_id: str, reference_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Calcule la consommation d'un budget à une date de référence (défaut: aujourd'hui).
    """
    ref_dt = _parse_date(reference_date) if reference_date else date.today()
    budget = get_budget_by_id(db, budget_id)
    if not budget:
        raise ValueError(f"Budget {budget_id} introuvable")

    debut, fin = _get_period_bounds(budget, ref_dt)
    
    # Clé de cache : {budgetId}_{debut}_{fin}
    cache_key = f"{budget_id}_{debut}_{fin}"
    cached = get_consumption_cache(db, cache_key)
    
    if cached:
        # On vérifie si le cache est encore frais (facultatif si on invalide bien à l'import)
        depense = cached["depense"]
        transaction_ids = cached["transactionIds"]
    else:
        # Calculer
        txs = get_transactions_by_category_period(
            db, 
            budget["categorie"], 
            debut, 
            fin, 
            compte=budget.get("compte")
        )
        
        # Exclure Virements internes et calculer les montants
        counting_txs = [t for t in txs if t.get("categorie") != "Virement interne"]
        net_amount = sum(float(t.get("montant", 0)) for t in counting_txs)
        gross_amount = sum(abs(float(t.get("montant", 0))) for t in counting_txs)
        
        # Détection Revenu (Heuristique)
        revenus_keywords = ["Salaire", "CAF", "Remboursement", "Revenu", "Prime"]
        is_income = any(kw in budget["categorie"] for kw in revenus_keywords)
        
        # Pour les budgets de dépenses, on compte aussi les montants positifs
        # (ex: remboursements) au lieu de ne garder que le net.
        depense = net_amount if is_income else gross_amount
        transaction_ids = [t["id"] for t in counting_txs]
        
        # Mettre en cache
        set_consumption_cache(db, cache_key, {
            "budgetId": budget_id,
            "periodeKey": f"{debut}_{fin}",
            "depense": depense,
            "isIncome": is_income,
            "transactionIds": transaction_ids
        })

    is_income = cached.get("isIncome", False) if cached else is_income
    montant = float(budget["montant"])
    reste = montant - depense
    pourcentage = (depense / montant * 100) if montant > 0 else 0
    
    # Calcul du rythme théorique
    rythme_theorique = _calculate_rythme_theorique(budget, ref_dt, debut, fin)
    
    ecart_rythme = depense - rythme_theorique
    
    # Statut
    if is_income:
        # Pour les revenus, être au-dessus du rythme est OK. 
        # On s'inquiète si on est significativement en dessous.
        if depense < rythme_theorique * 0.5:
            statut = "depasse" # "Dépassement" au sens négatif (gros manque)
        elif depense < rythme_theorique * 0.85:
            statut = "attention"
        else:
            statut = "ok"
    else:
        if depense > montant:
            statut = "depasse"
        elif depense > rythme_theorique * 1.15:
            statut = "attention"
        else:
            statut = "ok"

    return {
        "budgetId": budget_id,
        "nom": budget["nom"],
        "categorie": budget["categorie"],
        "isIncome": is_income,
        "montant": montant,
        "depense": round(depense, 2),
        "reste": round(reste, 2),
        "pourcentage": round(pourcentage, 2),
        "rythmeTheorique": round(rythme_theorique, 2),
        "ecartRythme": round(ecart_rythme, 2),
        "statut": statut,
        "periodeDebut": debut,
        "periodeFin": fin,
        "transactionIds": transaction_ids
    }


def compute_all_consumptions(db, reference_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """Calcule la consommation de tous les budgets actifs."""
    budgets = list_budgets(db, actif_only=True)
    results = []
    for b in budgets:
        try:
            results.append(compute_consumption(db, b["id"], reference_date))
        except Exception as e:
            log.error(f"Erreur calcul consommation budget {b.get('nom')} ({b.get('id')}): {e}")
    return results


def invalidate_cache_for_category(db, categorie: str, date_str: str) -> None:
    """Invalide le cache pour tous les budgets touchés par une transaction."""
    # On récupère tous les budgets de cette catégorie
    budgets = query_budgets(db, filters={"categorie": categorie})
    tx_date = _parse_date(date_str)
    
    for b in budgets:
        # Si la date de la transaction tombe dans la période actuelle du budget, on invalide.
        # En fait, par sécurité, on pourrait invalider tout le cache du budget,
        # ou juste celui de la période concernée. 
        # Le prompt dit "Invalide le cache pour tous les budgets touchés".
        # On va supprimer tout le cache lié à ce budgetId pour être sûr.
        delete_consumption_cache(b["id"])


def suggest_budget_amount(db, categorie: str, months: int = 12) -> float:
    """Suggère un montant basé sur la moyenne des dépenses des N derniers mois."""
    fin_dt = date.today()
    debut_dt = (fin_dt.replace(day=1) - timedelta(days=months*30)).replace(day=1)
    
    txs = get_transactions_by_category_period(
        db, 
        categorie, 
        debut_dt.strftime("%Y-%m-%d"), 
        fin_dt.strftime("%Y-%m-%d")
    )
    
    # Filtrer les transactions et calculer le montant moyen "brut"
    # (somme des valeurs absolues) pour tenir compte des montants positifs.
    relevant_txs = [t for t in txs if t.get("categorie") != "Virement interne"]
    total_abs = sum(abs(float(t.get("montant", 0))) for t in relevant_txs)
    
    if months <= 0: return 0.0
    return round(total_abs / months, 2)


# --- Helpers Internes ---

def _validate_budget_data(data: Dict[str, Any]) -> None:
    """Valide la structure d'un budget."""
    if float(data.get("montant", 0)) <= 0:
        raise ValueError("Le montant doit être supérieur à 0")
    
    b_type = data.get("type")
    periode = data.get("periode", {})
    p_type = periode.get("type")
    
    if b_type == "mensuel":
        if p_type != "mois_courant":
            raise ValueError("Un budget mensuel doit avoir une période de type 'mois_courant'")
    elif b_type == "annuel":
        if p_type not in ["annee_civile", "annee_glissante"]:
            raise ValueError("Un budget annuel doit avoir une période de type 'annee_civile' ou 'annee_glissante'")
    elif b_type == "ponctuel":
        if p_type != "custom":
            raise ValueError("Un budget ponctuel doit avoir une période de type 'custom'")
        if not periode.get("debut") or not periode.get("fin"):
            raise ValueError("Un budget ponctuel doit avoir une date de début et de fin")
    else:
        raise ValueError(f"Type de budget inconnu : {b_type}")


def _get_period_bounds(budget: Dict[str, Any], ref_dt: date) -> tuple[str, str]:
    """Calcule les bornes [debut, fin] de la période du budget."""
    p_type = budget["periode"]["type"]
    
    if p_type == "mois_courant":
        debut = ref_dt.replace(day=1)
        _, last_day = monthrange(ref_dt.year, ref_dt.month)
        fin = ref_dt.replace(day=last_day)
    elif p_type == "annee_civile":
        debut = date(ref_dt.year, 1, 1)
        fin = date(ref_dt.year, 12, 31)
    elif p_type == "annee_glissante":
        fin = ref_dt
        try:
            debut = ref_dt.replace(year=ref_dt.year - 1) + timedelta(days=1)
        except ValueError: # Cas du 29 février
            debut = ref_dt.replace(year=ref_dt.year - 1, day=28) + timedelta(days=1)
    elif p_type == "custom":
        debut = _parse_date(budget["periode"]["debut"])
        fin = _parse_date(budget["periode"]["fin"])
    else:
        raise ValueError(f"Type de période inconnu : {p_type}")
        
    return debut.strftime("%Y-%m-%d"), fin.strftime("%Y-%m-%d")


def _calculate_rythme_theorique(budget: Dict[str, Any], ref_dt: date, debut_str: str, fin_str: str) -> float:
    """Calcule le montant qui devrait être consommé à ref_dt selon le rythme théorique."""
    debut = _parse_date(debut_str)
    fin = _parse_date(fin_str)
    montant = float(budget["montant"])
    
    jours_totaux = (fin - debut).days + 1
    jours_ecoules = min(max(0, (ref_dt - debut).days + 1), jours_totaux)
    
    mois_attendus = budget.get("moisAttendus", [])
    if budget.get("type") == "annuel" and mois_attendus:
        # Rythme basé sur les mois attendus
        # mois_attendus est une liste d'entiers 1-12
        nb_mois_total = len(mois_attendus)
        # On compte combien de mois attendus sont déjà passés (ou en cours)
        # Pour simplifier, on considère qu'un mois est "passé" si ref_dt est >= dernier jour du mois
        # Ou plus simplement, si ref_dt.month >= m (pour annee_civile)
        
        if budget["periode"]["type"] == "annee_civile":
            mois_ecoules = [m for m in mois_attendus if m < ref_dt.month]
            mois_actuel_est_attendu = ref_dt.month in mois_attendus
            
            proportion_mois_actuel = 0
            if mois_actuel_est_attendu:
                _, last_day = monthrange(ref_dt.year, ref_dt.month)
                proportion_mois_actuel = ref_dt.day / last_day
            
            nb_mois_ecoules = len(mois_ecoules) + proportion_mois_actuel
            return montant * (nb_mois_ecoules / nb_mois_total)
    
    # Rythme linéaire par défaut
    return montant * (jours_ecoules / jours_totaux)


def _parse_date(date_str: str) -> date:
    """Parse une date YYYY-MM-DD."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()
