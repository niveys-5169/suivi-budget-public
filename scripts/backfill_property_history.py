#!/usr/bin/env python3
"""
scripts/backfill_property_history.py — Reconstruit l'historique de valeur des biens immobiliers.
===============================================================================================

Le snapshot quotidien n'historise un bien qu'à partir du jour de son ajout : la
courbe du patrimoine saute alors de la valeur totale d'un coup. Ce script écrit,
dans `placement_history`, un relevé à la date d'achat (`--start`, 21/01/2017 par
défaut) puis au 1er de chaque mois, jusqu'au premier relevé existant du bien.

Valeur d'un mois = valeur actuelle du bien × indice INSEE des prix des logements
anciens (appartements ou maisons) à cette date ÷ indice actuel. C'est une
reconstruction indicative, pas un historique d'estimations.

Idempotent : docId {assetId}_{date} + merge ; les mois déjà relevés ne sont
jamais touchés (seuls les mois antérieurs au premier relevé sont créés).

Usage :
    python scripts/backfill_property_history.py --dry-run
    python scripts/backfill_property_history.py [--start 2017-01-21] [--placement-id <id>]
"""

import argparse
import logging
import os
import sys
from datetime import date, datetime, timezone

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from property_estimator import _derniere_valeur, cle_trimestre  # noqa: E402

DEFAULT_START = "2017-01-21"  # date d'achat
SOURCE = "insee_backfill"


def _premiers_du_mois(debut: date, fin: date):
    """`debut` (date d'achat), puis le 1er de chaque mois suivant, jusqu'à `fin` exclu."""
    jour = debut
    while jour < fin:
        yield jour
        jour = date(jour.year + (jour.month == 12), jour.month % 12 + 1, 1)


def plan_backfill(
    asset_id: str,
    nom: str,
    owner: str | None,
    montant: float,
    serie: dict[str, float],
    debut: date,
    premier_releve: date,
    aujourd_hui: date,
) -> list[tuple[str, dict]]:
    """Relevés (docId, payload) mensuels à créer avant `premier_releve`, valeur réindexée sur l'INSEE."""
    actuel = _derniere_valeur(serie, cle_trimestre(aujourd_hui))
    if not montant or not actuel or not actuel[1]:
        return []

    plan = []
    for jour in _premiers_du_mois(debut, premier_releve):
        point = _derniere_valeur(serie, cle_trimestre(jour))
        if not point:
            continue
        date_str = jour.isoformat()
        plan.append((
            f"{asset_id}_{date_str}",
            {
                "date": date_str,
                "assetId": asset_id,
                "nom": nom,
                "montant": round(montant * point[1] / actuel[1], 2),
                "type": "immobilier",
                "owner": owner,
                "source": SOURCE,
                "snapshotAt": datetime.now(timezone.utc),
            },
        ))
    return plan


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default=DEFAULT_START, help="Date d'achat, premier relevé créé (AAAA-MM-JJ).")
    parser.add_argument("--placement-id", help="Ne traiter que ce bien.")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture.")
    args = parser.parse_args()

    from google.cloud.firestore_v1.base_query import FieldFilter
    from firebase_db import _get_db
    from property_valuation import INSEE_IDBANK, INSEE_IDBANK_ENSEMBLE, serie_insee

    db = _get_db()
    history_col = db.collection("placement_history")
    aujourd_hui = date.today()
    debut = date.fromisoformat(args.start)

    snaps = list(db.collection("placements").where(filter=FieldFilter("type", "==", "immobilier")).stream())
    if args.placement_id:
        snaps = [s for s in snaps if s.id == args.placement_id]

    total = 0
    for snap in snaps:
        doc = snap.to_dict() or {}
        premier = [
            h.to_dict().get("date")
            for h in history_col.where(filter=FieldFilter("assetId", "==", snap.id)).stream()
        ]
        premier = min((d for d in premier if d), default=aujourd_hui.isoformat())

        nature = (doc.get("bien") or {}).get("nature")
        serie = serie_insee(INSEE_IDBANK.get(nature, INSEE_IDBANK_ENSEMBLE)) or serie_insee(INSEE_IDBANK_ENSEMBLE)
        plan = plan_backfill(
            snap.id, doc.get("nom", "Bien immobilier"), doc.get("owner"),
            float(doc.get("montant") or 0), serie, debut, date.fromisoformat(premier), aujourd_hui,
        )

        # Pas de montant dans les logs : ceux de GitHub Actions sont publics sur ce dépôt.
        prefix = "[dry-run] " if args.dry_run else ""
        log.info(f"{prefix}{snap.id} : {len(plan)} relevé(s) mensuel(s) avant le {premier}.")
        if not args.dry_run:
            for doc_id, payload in plan:
                history_col.document(doc_id).set(payload, merge=True)
        total += len(plan)

    log.info(f"{total} relevé(s) {'à créer (simulation)' if args.dry_run else 'créé(s)'}.")


if __name__ == "__main__":
    main()
