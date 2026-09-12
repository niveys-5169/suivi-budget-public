"""
src/balance_coherence.py
Fonctions pures pour le calcul de cohérence des soldes.

Ces fonctions n'ont pas de dépendances Firestore — elles sont
testables unitairement sans mock et partagées entre src/ et functions/.
"""
from datetime import datetime, timezone


def ensure_utc(dt) -> datetime | None:
    """Normalise un datetime en aware UTC.

    Firestore renvoie des datetimes aware UTC. Gmail (internalDate/1000) peut
    produire un datetime naïf selon la variante utilisée. Cette fonction
    uniformise les deux pour éviter les TypeError lors des comparaisons.
    """
    if not isinstance(dt, datetime):
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def filter_window_transactions(
    transactions: list[dict],
    compte: str,
    old_email_date: datetime | None,
    upper_email_date: datetime | None,
) -> list[dict]:
    """Retourne les transactions du compte dans la fenêtre (old, upper].

    Seules les transactions avec un champ emailDate datetime (aware ou naïf)
    sont considérées. Les transactions sans emailDate (saisies manuellement,
    importées via historique) sont exclues du delta de réconciliation — elles
    ne font pas partie du batch email et ne peuvent pas être correctement
    situées dans la fenêtre.

    Bornes : old exclusif, upper inclusif.
    Si old_email_date est None, toutes les tx avec emailDate <= upper sont incluses.
    Si upper_email_date est None, toutes les tx avec emailDate > old sont incluses.
    """
    old_utc = ensure_utc(old_email_date)
    upper_utc = ensure_utc(upper_email_date)

    result = []
    for tx in transactions:
        if tx.get("compte") != compte:
            continue
        tx_email_date = ensure_utc(tx.get("emailDate"))
        if tx_email_date is None:
            continue
        if old_utc is not None and tx_email_date <= old_utc:
            continue
        if upper_utc is not None and tx_email_date > upper_utc:
            continue
        result.append(tx)
    return result


def _to_cents(x) -> int:
    """Convertit un montant euros en centimes entiers (arrondi au centime)."""
    return round(float(x) * 100)


def compute_coherence(
    previous_solde: float | None,
    nouveau_solde: float,
    window_txs: list[dict],
) -> dict:
    """Calcule la cohérence entre ancien solde, transactions et nouveau solde.

    La sommation se fait en centimes entiers (via _to_cents) pour éviter les
    erreurs d'accumulation flottante d'une longue liste de montants — un écart
    de quelques centimes dû à la seule imprécision binaire pourrait sinon
    basculer à tort un solde réconcilié en pending_review sous tolérance zéro.

    Retourne un dict avec :
      - previousSolde   : ancien solde (None si inconnu)
      - linxoDelta      : somme des montants des transactions de la fenêtre
      - computedSolde   : previousSolde + linxoDelta
      - ecart           : nouveau_solde - computedSolde (arrondi à 2 décimales)

    Tous les champs sont None si previous_solde est None.
    """
    if previous_solde is None:
        return {
            "previousSolde": None,
            "linxoDelta": None,
            "computedSolde": None,
            "ecart": None,
        }

    delta_cents = sum(_to_cents(t.get("montant", 0)) for t in window_txs)
    computed_cents = _to_cents(previous_solde) + delta_cents
    ecart_cents = _to_cents(nouveau_solde) - computed_cents
    return {
        "previousSolde": previous_solde,
        "linxoDelta": delta_cents / 100,
        "computedSolde": computed_cents / 100,
        "ecart": round(ecart_cents / 100, 2),
    }


def resolve_status(ecart: float | None, tolerance: float) -> str:
    """Détermine le statut de réconciliation.

    - ecart is None  → "reconciled" (premier solde, rien à comparer)
    - |ecart| <= tolerance → "reconciled"
    - |ecart| > tolerance  → "pending_review"

    N.B. : `ecart or 0` (pattern précédent) transformait None en 0 et forçait
    toujours "reconciled" pour un premier solde, mais aussi masquait les vraies
    erreurs quand ecart valait 0.0 par hasard après un TypeError. Cette fonction
    distingue explicitement les deux cas.
    """
    if ecart is None:
        return "reconciled"
    return "reconciled" if abs(ecart) <= tolerance else "pending_review"
