"""
scripts/backfill_linxo_pending.py — Rattrapage des emails Linxo mal importés.
============================================================================

Entre le 25/07/2026 et le correctif de `reconcile_pending`, le parser ignorait
toute opération « Opération en attente ». Or Linxo ne re-notifie pas les cartes
et prélèvements une fois réalisés : ces transactions ont été perdues, et les
emails concernés portent déjà le label `Linxo_Importé` qui les exclut
définitivement de la requête d'import.

Ce script retire ce label (et l'entrée `processed_emails` côté Cloud Function)
pour rendre les emails à nouveau éligibles. Le réimport lui-même est fait par
l'import normal : cron `linxo-poll` ou `repository_dispatch: import-linxo`.

Sans risque de doublon : `_transaction_id` est déterministe,
`sauvegarder_transactions` préserve les champs édités par l'utilisateur et
respecte la collection `deleted_transactions`.

Usage :
    python scripts/backfill_linxo_pending.py --dry-run
    python scripts/backfill_linxo_pending.py --since 2026-07-25
"""

import argparse
import logging
import os
import sys
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from importer import CONFIG, get_credentials
from gmail_client import GmailClient
from firebase_db import is_firebase_available, _get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Date du commit qui a introduit le filtre « en attente » (95cb738).
DEFAULT_SINCE = "2026-07-25"


def backfill(since: str, dry_run: bool) -> int:
    label = CONFIG["GMAIL_LABEL"]
    gmail = GmailClient(get_credentials())

    after = since.replace("-", "/")
    query = f"from:assistance@linxo.com subject:Notification label:{label} after:{after}"
    messages = gmail.search_emails(query, max_results=100)
    log.info(f"{len(messages)} email(s) Linxo déjà importés depuis le {since}.")

    db = _get_db() if is_firebase_available() else None
    if db is None:
        log.warning("Firebase indisponible : les entrées processed_emails ne seront pas purgées.")

    count = 0
    for msg_ref in messages:
        msg_id = msg_ref["id"]
        details = gmail.get_message_metadata(msg_id)
        recu = datetime.fromtimestamp(int(details["internalDate"]) / 1000)

        if dry_run:
            log.info(f"[dry-run] {msg_id} — reçu le {recu:%d/%m/%Y %H:%M}")
            count += 1
            continue

        gmail.remove_label(msg_id, label)
        if db is not None:
            db.collection("processed_emails").document(msg_id).delete()
        log.info(f"Ré-armé : {msg_id} — reçu le {recu:%d/%m/%Y %H:%M}")
        count += 1

    return count


def main():
    parser = argparse.ArgumentParser(description="Ré-arme les emails Linxo pour réimport.")
    parser.add_argument("--since", default=DEFAULT_SINCE, help="Date AAAA-MM-JJ (défaut : %(default)s)")
    parser.add_argument("--dry-run", action="store_true", help="Liste les emails sans rien modifier.")
    args = parser.parse_args()

    try:
        datetime.strptime(args.since, "%Y-%m-%d")
    except ValueError:
        parser.error("--since attend une date au format AAAA-MM-JJ.")

    count = backfill(args.since, args.dry_run)

    if args.dry_run:
        log.info(f"{count} email(s) seraient ré-armés. Relancer sans --dry-run pour appliquer.")
    else:
        log.info(f"{count} email(s) ré-armés. Relancer l'import (repository_dispatch: import-linxo).")
        log.info("Note : src/importer.py traite 15 emails par run — relancer plusieurs fois si besoin.")


if __name__ == "__main__":
    main()
