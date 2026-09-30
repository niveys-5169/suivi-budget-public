"""
dedup.py — Shared deduplication logic for importers
====================================================

Used by tronity_importer.py and the Linxo import to avoid duplicating
the same 3-level deduplication algorithm.
"""

from bisect import bisect_left, bisect_right
from collections import Counter
from datetime import datetime, date, timedelta

LIBELLE_MAX_LEN = 40
PROBABLE_WINDOW_DAYS = 3
PENDING_TRANSFER_LABELS = frozenset({"INSTANTANE", "SEPA"})


def _date_obj(valeur):
    """Normalise une date (datetime, date ou 'YYYY-MM-DD…') en `date`, ou None."""
    if isinstance(valeur, datetime):
        return valeur.date()
    if isinstance(valeur, date):
        return valeur
    try:
        return datetime.strptime(str(valeur)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def deduplicate(
    nouvelles: list[dict],
    existantes: list[dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Sépare les nouvelles transactions en 3 groupes :
      - a_importer : pas de doublon détecté
      - stricts    : compte + date + libelle[:40] + montant identiques (certains doublons)
      - probables  : compte + montant identiques, date à ±3 jours (libellé différent)

    Le `compte` fait partie de toutes les clés : deux comptes distincts peuvent
    porter la même opération (même montant, même jour) sans être confondus —
    sinon une transaction légitime disparaît silencieusement de l'import.

    Args:
        nouvelles  : transactions normalisées (dict avec date datetime)
        existantes : transactions Firestore pour la fenêtre de déduplication
    """
    strict_keys: set[tuple] = set()
    # (compte, montant) -> liste triée de dates, pour une recherche ±N jours en O(log N)
    dm_index: dict[tuple[str, str], list[date]] = {}

    for t in existantes:
        date_s = str(t.get("date", "")).strip()
        libelle_s = str(t.get("libelle", "")).strip()[:LIBELLE_MAX_LEN]
        compte_s = str(t.get("compte", "")).strip()
        try:
            montant_s = f"{float(t['montant']):.2f}"
            d_obj = datetime.strptime(date_s, "%Y-%m-%d").date()
        except (KeyError, TypeError, ValueError):
            continue
        strict_keys.add((compte_s, date_s, libelle_s, montant_s))
        dm_index.setdefault((compte_s, montant_s), []).append(d_obj)

    for dates in dm_index.values():
        dates.sort()

    a_importer, stricts, probables = [], [], []

    for tx in nouvelles:
        try:
            tx_date = tx["date"]
            if isinstance(tx_date, datetime):
                tx_date_obj = tx_date.date()
            elif isinstance(tx_date, date):
                tx_date_obj = tx_date
            else:
                tx_date_obj = datetime.strptime(str(tx_date)[:10], "%Y-%m-%d").date()

            date_s = tx_date_obj.strftime("%Y-%m-%d")
            libelle_s = str(tx.get("libelle", ""))[:LIBELLE_MAX_LEN]
            compte_s = str(tx.get("compte", "")).strip()
            montant_s = f"{float(tx['montant']):.2f}"
        except (KeyError, TypeError, ValueError):
            continue

        if (compte_s, date_s, libelle_s, montant_s) in strict_keys:
            stricts.append(tx)
            continue

        nearby = dm_index.get((compte_s, montant_s))
        if nearby:
            lo = tx_date_obj - timedelta(days=PROBABLE_WINDOW_DAYS)
            hi = tx_date_obj + timedelta(days=PROBABLE_WINDOW_DAYS)
            # Fenêtre inclusive [lo, hi] sur la liste triée des dates
            if bisect_left(nearby, lo) < bisect_right(nearby, hi):
                probables.append(tx)
                continue

        a_importer.append(tx)

    return a_importer, stricts, probables


def _cle_compte_montant(tx: dict) -> tuple[str, str] | None:
    """Clé (compte, montant) commune aux deux passes, ou None si inexploitable."""
    try:
        return str(tx.get("compte", "")).strip(), f"{float(tx['montant']):.2f}"
    except (KeyError, TypeError, ValueError):
        return None


def _cle_virement_en_attente(tx: dict) -> tuple[str, str, str] | None:
    """Seuls les virements génériques Linxo peuvent être re-notifiés datés du jour."""
    libelle = str(tx.get("libelle", "")).strip()
    cle = _cle_compte_montant(tx)
    if tx.get("enAttente") and libelle in PENDING_TRANSFER_LABELS and cle and cle[0]:
        return *cle, libelle
    return None


def _filtrer_virements_en_attente_repetes(nouvelles: list[dict], existantes: list[dict]) -> list[dict]:
    """Garde le maximum d'occurrences par date, sans fusionner celles d'un même jour.

    La première date reste canonique ; une répétition ignorée ne prolonge pas
    la fenêtre. Les champs utilisateur du document stocké restent intacts.
    """
    par_date: dict[tuple[str, str, str], Counter[date]] = {}
    for tx in existantes:
        cle, d = _cle_virement_en_attente(tx), _date_obj(tx.get("date"))
        if cle and d:
            par_date.setdefault(cle, Counter())[d] += 1

    occurrences: Counter[tuple[tuple[str, str, str], date]] = Counter()
    gardees: set[int] = set()
    # Gmail peut livrer les mails du plus récent au plus ancien.
    ordre = sorted(enumerate(nouvelles), key=lambda item: _date_obj(item[1].get("date")) or date.max)
    for i, tx in ordre:
        cle, d = _cle_virement_en_attente(tx), _date_obj(tx.get("date"))
        if not cle or not d:
            gardees.add(i)
            continue
        occurrences[cle, d] += 1
        dates = par_date.setdefault(cle, Counter())
        couvertes = max(
            (n for jour, n in dates.items() if abs((jour - d).days) <= PROBABLE_WINDOW_DAYS),
            default=0,
        )
        if occurrences[cle, d] > couvertes:
            gardees.add(i)
            dates[d] = occurrences[cle, d]
    return [tx for i, tx in enumerate(nouvelles) if i in gardees]


def reconcile_pending(
    nouvelles: list[dict],
    existantes: list[dict],
) -> tuple[list[dict], list[str]]:
    """Réconcilie les opérations « en attente » avec leur version réalisée.

    Linxo notifie certains virements deux fois : d'abord « en attente » avec un
    libellé générique (INSTANTANE, SEPA) et la date du mail, puis réalisés avec
    le vrai libellé et la date de valeur. Cartes et prélèvements, eux, ne sont
    notifiés qu'une seule fois — souvent « en attente » — et ne doivent donc
    jamais être ignorés : une opération en attente sans contrepartie réalisée
    est conservée.

    Avant la réconciliation, les notifications répétées de virements génériques
    encore en attente (même compte, montant, libellé INSTANTANE/SEPA, ±3 jours)
    sont retirées du nouveau lot si elles répètent un document stocké ou une
    autre notification du lot. Ce filtre précède `deduplicate` pour que
    l'import incrémental ne réadmette pas ces doublons « probables ».

    Deux passes ensuite, clé (compte, montant) et fenêtre ±PROBABLE_WINDOW_DAYS :
      1. intra-lot : une nouvelle transaction « en attente » couverte par une
         nouvelle transaction réalisée est retirée du lot ;
      2. vs Firestore : une nouvelle transaction réalisée qui confirme une
         transaction « en attente » déjà stockée renvoie l'ID de celle-ci, pour
         suppression une fois la version réalisée sauvegardée.

    Chaque document en attente stocké n'est consommé qu'une seule fois (appariement
    au plus proche en date) : deux prélèvements du même montant ne s'annulent pas
    mutuellement.

    Returns:
        (nouvelles_filtrees, ids_en_attente_obsoletes)
    """
    nouvelles = _filtrer_virements_en_attente_repetes(nouvelles, existantes)
    # ─── Passe 1 : intra-lot ────────────────────────────────────────────────
    realisees: dict[tuple[str, str], list[date]] = {}
    for tx in nouvelles:
        if tx.get("enAttente"):
            continue
        cle, d = _cle_compte_montant(tx), _date_obj(tx.get("date"))
        if cle and d:
            realisees.setdefault(cle, []).append(d)
    for dates in realisees.values():
        dates.sort()

    filtrees = []
    for tx in nouvelles:
        d = _date_obj(tx.get("date"))
        cle = _cle_compte_montant(tx)
        if tx.get("enAttente") and cle and d:
            proches = realisees.get(cle)
            if proches and bisect_left(
                proches, d - timedelta(days=PROBABLE_WINDOW_DAYS)
            ) < bisect_right(proches, d + timedelta(days=PROBABLE_WINDOW_DAYS)):
                continue
        filtrees.append(tx)

    # ─── Passe 2 : vs Firestore ─────────────────────────────────────────────
    stockees_en_attente: dict[tuple[str, str], list[tuple[date, str]]] = {}
    for t in existantes:
        if not t.get("enAttente") or not t.get("id"):
            continue
        cle, d = _cle_compte_montant(t), _date_obj(t.get("date"))
        if cle and d:
            stockees_en_attente.setdefault(cle, []).append((d, str(t["id"])))

    obsoletes: list[str] = []
    consommes: set[str] = set()
    for tx in filtrees:
        if tx.get("enAttente"):
            continue
        cle, d = _cle_compte_montant(tx), _date_obj(tx.get("date"))
        if not cle or not d:
            continue
        candidats = [
            (abs((d_stockee - d).days), doc_id)
            for d_stockee, doc_id in stockees_en_attente.get(cle, [])
            if doc_id not in consommes
            and abs((d_stockee - d).days) <= PROBABLE_WINDOW_DAYS
        ]
        if candidats:
            _, doc_id = min(candidats)
            consommes.add(doc_id)
            obsoletes.append(doc_id)

    return filtrees, obsoletes
