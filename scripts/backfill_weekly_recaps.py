#!/usr/bin/env python3
"""
scripts/backfill_weekly_recaps.py — Recalcule l'historique des fiches « Ma semaine ».
====================================================================================

L'email hebdomadaire enregistre chaque semaine sa fiche dans `weekly_recaps`, affichée
par la page `/semaine` de l'application. Ce script crée les fiches des semaines passées,
alignées sur le jour d'envoi configuré (`config/weekly_report.dayOfWeek`).

Limites : les soldes ne sont pas historisés (seule la semaine la plus récente reprend
les soldes actuels) ; budgets et récurrences sont ceux d'aujourd'hui.
Idempotent : les fiches existantes sont conservées, sauf `--overwrite`.

Usage :
    python scripts/backfill_weekly_recaps.py --weeks 12 --dry-run
    python scripts/backfill_weekly_recaps.py --weeks 12
"""

import argparse
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--weeks', type=int, default=12, help='Nombre de semaines à recalculer')
    parser.add_argument('--overwrite', action='store_true', help='Remplace les fiches existantes')
    parser.add_argument('--dry-run', action='store_true', help="N'écrit rien dans Firestore")
    args = parser.parse_args()

    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
    from firebase_db import _get_db
    from weekly_recap import backfill_weekly_recaps

    written = backfill_weekly_recaps(_get_db(), weeks=args.weeks, overwrite=args.overwrite, dry_run=args.dry_run)
    verb = 'à créer' if args.dry_run else 'créées'
    log.info(f"{len(written)} fiche(s) {verb} : {', '.join(written) or 'aucune'}")


if __name__ == '__main__':
    main()
