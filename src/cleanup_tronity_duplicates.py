#!/usr/bin/env python3
"""
cleanup_tronity_duplicates.py — Supprime les recharges Tronity en double.

Deux modes :

  doublons (défaut)
      Regroupe les recharges par ID de session Tronity et ne garde qu'un
      document par session (le pointé s'il existe, sinon celui dont l'ID n'est
      pas suffixé `_2`, `_3`, …). C'est le mode à utiliser après une import
      ayant dupliqué chaque recharge : les recharges légitimes sont conservées.

  non-pointees
      Supprime TOUTES les recharges Tronity non pointées (mode historique) :
      les recharges exactes ont été pointées manuellement dans le dashboard, on
      supprime tout le reste. À n'utiliser que si les doublons ne sont pas
      identifiables par leur ID de session.

Chaque suppression écrit aussi le tombstone `deleted_transactions` (même format
que `removeTransaction`/`batchRemoveTransactions` côté dashboard) : sans lui,
l'import Tronity automatique suivant recrée le document sous son ID déterministe
et la recharge supprimée réapparaît.

Usage :
    python cleanup_tronity_duplicates.py [--mode doublons|non-pointees] [--dry-run]

Options :
  --dry-run  Affiche ce qui serait supprimé sans toucher Firestore.
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from firebase_db import _get_db, _run_with_backoff, _stream_with_backoff

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

LIBELLE_RECHARGE = "Recharge domicile EV"

# 2 écritures par recharge (suppression + tombstone) : on reste sous la limite
# Firestore de 500 opérations par batch.
CHUNK_SIZE = 249

# Suffixe ajouté par sauvegarder_transactions quand plusieurs transactions
# partagent le même ID de base dans un lot (`…_2`, `…_3`, …).
SUFFIXE_DOUBLON = re.compile(r"_\d+$")


def _doc_a_conserver(docs: list[tuple[str, bool]]) -> str:
    """Choisit le document à garder parmi les exemplaires d'une même session.

    Priorité : le document pointé (édité par l'utilisateur), puis celui dont
    l'ID n'a pas de suffixe de doublon, puis le premier par ordre d'ID.
    """
    return min(
        docs,
        key=lambda d: (not d[1], bool(SUFFIXE_DOUBLON.search(d[0])), d[0]),
    )[0]


def _collecter_doublons_par_session(col) -> list[str]:
    """IDs des exemplaires surnuméraires, regroupés par (compte, session)."""
    from google.cloud.firestore_v1.base_query import FieldFilter

    query = col.where(filter=FieldFilter("source", "==", "tronity"))

    groupes: dict[tuple[str, str], list[tuple[str, bool]]] = {}
    sans_session = 0
    for doc in _stream_with_backoff(query, "Chargement recharges Tronity"):
        data = doc.to_dict() or {}
        session_id = str(data.get("tronity_session_id", "")).strip()
        if not session_id:
            sans_session += 1
            continue
        cle = (str(data.get("compte", "")).strip(), session_id)
        groupes.setdefault(cle, []).append((doc.id, bool(data.get("pointe"))))

    if sans_session:
        log.info(
            "%d recharge(s) sans tronity_session_id ignorée(s) "
            "(regroupement impossible).",
            sans_session,
        )

    to_delete = []
    for docs in groupes.values():
        if len(docs) < 2:
            continue
        garde = _doc_a_conserver(docs)
        to_delete.extend(doc_id for doc_id, _ in docs if doc_id != garde)

    log.info(
        "%d session(s) Tronity, dont %d en plusieurs exemplaires.",
        len(groupes),
        sum(1 for docs in groupes.values() if len(docs) > 1),
    )
    return to_delete


def _collecter_non_pointees(col) -> list[str]:
    """IDs de toutes les recharges Tronity non pointées (mode historique)."""
    from google.cloud.firestore_v1.base_query import FieldFilter

    query = (
        col
        .where(filter=FieldFilter("source", "==", "tronity"))
        .where(filter=FieldFilter("libelle", "==", LIBELLE_RECHARGE))
        .where(filter=FieldFilter("pointe", "==", False))
    )
    return [doc.id for doc in _stream_with_backoff(query, "Chargement recharges non pointées")]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("doublons", "non-pointees"),
        default="doublons",
        help="doublons : garde un exemplaire par session Tronity (défaut). "
             "non-pointees : supprime toutes les recharges non pointées.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture.")
    args = parser.parse_args()

    db = _get_db()
    col = db.collection("transactions")
    deleted_col = db.collection("deleted_transactions")

    if args.mode == "doublons":
        log.info("Chargement des recharges Tronity (regroupement par session)…")
        to_delete = _collecter_doublons_par_session(col)
    else:
        log.info("Chargement des recharges Tronity non pointées…")
        to_delete = _collecter_non_pointees(col)

    log.info("%d recharge(s) à supprimer.", len(to_delete))

    if not to_delete:
        log.info("Rien à supprimer.")
        return

    if args.dry_run:
        log.info("[DRY-RUN] Ces %d documents seraient supprimés :", len(to_delete))
        for doc_id in to_delete[:20]:
            log.info("  - %s", doc_id)
        if len(to_delete) > 20:
            log.info("  … et %d autres.", len(to_delete) - 20)
        return

    now = datetime.now(timezone.utc)
    deleted = 0
    for i in range(0, len(to_delete), CHUNK_SIZE):
        chunk = to_delete[i:i + CHUNK_SIZE]
        batch = db.batch()
        for doc_id in chunk:
            batch.delete(col.document(doc_id))
            batch.set(
                deleted_col.document(doc_id),
                {
                    "transactionId": doc_id,
                    "deletedAt": now,
                    "deletedBy": "cleanup_tronity_duplicates.py",
                    "source": "cleanup_script",
                },
                merge=True,
            )
        _run_with_backoff(lambda b=batch: b.commit(), "Suppression batch")
        deleted += len(chunk)
        log.info("%d/%d supprimés…", deleted, len(to_delete))

    log.info("✓ %d recharge(s) supprimée(s) (avec tombstone).", deleted)


if __name__ == "__main__":
    main()
