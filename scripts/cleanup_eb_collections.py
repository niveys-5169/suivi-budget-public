"""
scripts/cleanup_eb_collections.py — Nettoyage des collections Enable Banking orphelines.
=======================================================================================

Depuis le retrait de l'intégration Enable Banking (aucun code ne lit ni n'écrit
plus ces collections), les documents `eb_sessions/{session_id}` et
`eb_pending_auth/{state}` subsistent en base sans plus aucun usage. Ce script les
supprime.

Sans effet sur les données financières : `eb_sessions` ne stockait que les
métadonnées de connexion bancaire (mapping compte -> banque, validité du
consentement) et `eb_pending_auth` des demandes d'autorisation OAuth éphémères.
Les transactions et les soldes déjà importés vivent dans d'autres collections et
ne sont pas touchés.

Usage :
    python scripts/cleanup_eb_collections.py                 # dry-run (défaut)
    python scripts/cleanup_eb_collections.py --apply         # applique les suppressions
"""

import argparse
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import _get_db, is_firebase_available

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Collections abandonnées par le retrait d'Enable Banking.
EB_COLLECTIONS = ("eb_sessions", "eb_pending_auth")


def main():
    parser = argparse.ArgumentParser(
        description="Supprime les collections Enable Banking orphelines (eb_sessions, eb_pending_auth)."
    )
    parser.add_argument("--apply", action="store_true", help="Applique réellement les suppressions.")
    args = parser.parse_args()

    if not is_firebase_available():
        log.error("FIREBASE_CREDENTIALS non défini.")
        sys.exit(1)

    db = _get_db()

    total = 0
    for name in EB_COLLECTIONS:
        docs = list(db.collection(name).stream())
        log.info(f"Collection '{name}' : {len(docs)} document(s) à supprimer.")
        for doc in docs[:10]:
            log.info(f"  - {doc.id}")
        if len(docs) > 10:
            log.info(f"  … et {len(docs) - 10} autre(s).")
        total += len(docs)

        if args.apply:
            batch = db.batch()
            for i, doc in enumerate(docs, start=1):
                batch.delete(doc.reference)
                if i % 500 == 0:
                    batch.commit()
                    batch = db.batch()
            batch.commit()

    if not args.apply:
        log.info("")
        log.info(f"DRY-RUN : {total} document(s) seraient supprimé(s). Relancer avec --apply pour appliquer.")
        return

    log.info(f"Terminé : {total} document(s) supprimé(s).")


if __name__ == "__main__":
    main()
