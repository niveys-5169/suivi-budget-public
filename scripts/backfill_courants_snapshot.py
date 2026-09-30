#!/usr/bin/env python3
"""
scripts/backfill_courants_snapshot.py — Rattrape un relevé manquant des comptes courants.
========================================================================================

La capacité d'épargne mensuelle lit, dans `placement_history`, le solde de chaque
compte courant au 1er du mois (ouverture) et au 1er du mois suivant (clôture).
Les relevés historiques importés d'Excel sautent du 30/04 au 03/06/2026 et le
snapshot quotidien ne démarre que le 04/06 : aucun point ne couvre le 01/06/2026,
clôture de mai et ouverture de juin. Ces deux mois restent « Calcul indisponible ».

Ce script crée le relevé manquant de chaque compte courant à partir du dernier
solde Linxo (`account_balance_history`) reçu avant la date, soit ce que le
snapshot quotidien de 00:05 UTC aurait enregistré ce jour-là. L'identité du
relevé (assetId, nom, type, propriétaire) est recopiée du premier relevé existant
du compte dans les jours suivants, pour rester le même actif côté patrimoine.

Idempotent : un compte déjà relevé à la date est laissé tel quel.

Usage :
    python scripts/backfill_courants_snapshot.py --dry-run
    python scripts/backfill_courants_snapshot.py [--date 2026-06-01]
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

DEFAULT_DATE = "2026-06-01"

# Même tolérance que BOUNDARY_TOLERANCE_DAYS (useMonthlySavingsPosition.ts) :
# un solde plus ancien ne représente plus le compte à la date.
TOLERANCE_DAYS = 3

# Fenêtre de recherche du relevé modèle après la date.
TEMPLATE_DAYS = 7

COURANT_TYPES = {"courants", "courant", "cash", "liquidités", "liquidites"}


def _balance_window(date: str) -> tuple[datetime, datetime]:
    """Intervalle [début, date à 00:00 UTC[ des soldes Linxo acceptés pour la date."""
    cutoff = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return cutoff - timedelta(days=TOLERANCE_DAYS), cutoff


def plan_backfill(date: str, snapshots: list[dict], balances: list[dict]) -> list[tuple[str, dict]]:
    """Retourne les relevés (docId, payload) à créer dans placement_history.

    `snapshots` : relevés placement_history à partir de `date`, par date croissante.
    `balances`  : soldes account_balance_history, par emailDate croissante.
    """
    earliest, cutoff = _balance_window(date)
    courants = [
        s for s in snapshots
        if str(s.get("type", "")).strip().lower() in COURANT_TYPES
        and s.get("nom") and s.get("assetId")
    ]
    deja_releves = {s["nom"] for s in courants if s["date"] == date}

    modeles: dict[str, dict] = {}
    for s in courants:
        modeles.setdefault(s["nom"], s)

    dernier_solde: dict[str, dict] = {}
    for b in balances:
        if earliest <= b["emailDate"] < cutoff:
            dernier_solde[b["compte"]] = b

    plan = []
    for nom, modele in modeles.items():
        solde = dernier_solde.get(nom)
        if nom in deja_releves or solde is None:
            continue
        plan.append((
            f"{modele['assetId']}_{date}",
            {
                "date": date,
                "assetId": modele["assetId"],
                "nom": nom,
                "montant": float(solde["solde"]),
                "type": modele["type"],
                "owner": modele.get("owner"),
                "source": "linxo_backfill",
                "snapshotAt": solde["emailDate"],
            },
        ))
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=DEFAULT_DATE, help="Date du relevé à créer (AAAA-MM-JJ).")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture.")
    args = parser.parse_args()

    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
    from firebase_db import _get_db
    from google.cloud.firestore_v1.base_query import FieldFilter

    db = _get_db()
    earliest, cutoff = _balance_window(args.date)
    template_end = (cutoff + timedelta(days=TEMPLATE_DAYS)).strftime("%Y-%m-%d")

    history_col = db.collection("placement_history")
    snapshots = [
        doc.to_dict() or {}
        for doc in history_col
        .where(filter=FieldFilter("date", ">=", args.date))
        .where(filter=FieldFilter("date", "<=", template_end))
        .order_by("date")
        .stream()
    ]
    balances = [
        b
        for b in (
            doc.to_dict() or {}
            for doc in db.collection("account_balance_history")
            .where(filter=FieldFilter("emailDate", ">=", earliest))
            .where(filter=FieldFilter("emailDate", "<", cutoff))
            .order_by("emailDate")
            .stream()
        )
        if b.get("compte") and b.get("solde") is not None
    ]
    log.info(
        f"{len(snapshots)} relevé(s) du {args.date} au {template_end}, "
        f"{len(balances)} solde(s) Linxo depuis le {earliest:%Y-%m-%d}."
    )

    plan = plan_backfill(args.date, snapshots, balances)
    if not plan:
        log.info("Rien à créer : comptes déjà relevés à la date, ou aucun solde Linxo récent.")
        return

    # Pas de montant dans les logs : ceux de GitHub Actions sont publics sur ce dépôt.
    for doc_id, payload in plan:
        prefix = "[dry-run] " if args.dry_run else ""
        log.info(f"{prefix}{doc_id} : solde Linxo du {payload['snapshotAt']:%Y-%m-%d %H:%M} UTC")
        if not args.dry_run:
            history_col.document(doc_id).set(payload, merge=True)

    action = "à créer (simulation)" if args.dry_run else "créé(s)"
    log.info(f"{len(plan)} relevé(s) {action}.")


if __name__ == "__main__":
    main()
