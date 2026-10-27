#!/usr/bin/env python3
"""
cleanup_bank_representation_duplicates.py — Supprime les doublons créés quand la
banque a servi une même opération comptabilisée sous deux formes (avec référence
et libellé long, puis sans référence et libellé court).

Une ligne est supprimée seulement si TOUTES ces conditions sont vérifiées :
  - elle vient d'Enable Banking (id `eb_…`), n'est pas pointée et n'a aucune
    modification utilisateur (commentaire, mois d'affectation, catégorie choisie
    à la main : une catégorie posée par le catégoriseur IA ne compte pas) ;
  - elle n'a qu'une observation, comptabilisée, sans lien Linxo, et aucune
    récurrence ne l'a approuvée ;
  - exactement une ligne pointée de même compte, date et montant porte déjà la
    même opération sous l'autre forme (`same_operation_other_shape`).
Les autres lignes candidates sont listées avec leur raison et laissées intactes.

Pour chaque ligne supprimée, dans cet ordre (une reprise après interruption est
sans danger : la ligne n'est retirée qu'en dernier) :
  1. copie complète dans `bank_cleanup_backups/{id}` (ligne et observation) ;
  2. tombstone `deleted_transactions/{id}` (même format que `removeTransaction`) ;
  3. l'observation est marquée `supersededBy` l'observation de la jumelle, ce qui
     empêche le moteur de la republier ;
  4. suppression de `transactions/{id}`.
Retour arrière : recopier `transaction` depuis la sauvegarde et supprimer le tombstone.

Usage :
    python cleanup_bank_representation_duplicates.py            # simulation
    python cleanup_bank_representation_duplicates.py --apply    # écriture

Le journal n'affiche que des identifiants et des compteurs, jamais libellés ni montants.
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from bank_reconciliation import cents, same_operation_other_shape

log = logging.getLogger("cleanup_bank_representation_duplicates")

SCRIPT = "cleanup_bank_representation_duplicates.py"


def _user_edited(row):
    return bool(row.get("commentaire") or row.get("moisAffectation")
                or (row.get("categorie") and not row.get("aiCategorized")))


def _key(row):
    return (row.get("compte"), str(row.get("date"))[:10], cents(row["montant"]))


def _approved_ids(recurrences):
    ids = set()
    for recurrence in recurrences:
        for approval in (recurrence.get("approvedMonths") or {}).values():
            if approval:
                ids.add(approval.get("txId"))
                ids.update(e.get("txId") for e in approval.get("entries", []))
    return ids - {None}


def plan(store):
    """Retourne {'delete': [entrées], 'skipped': [{'id', 'reason'}]} sans rien écrire."""
    observations = {o["id"]: o for o in store.all("bank_observations")}
    rows = store.all("transactions")
    approved = _approved_ids(store.all("recurrences"))
    pointed = {}
    for row in rows:
        if row.get("pointe"):
            pointed.setdefault(_key(row), []).append(row)
    result = {"delete": [], "skipped": []}
    for row in rows:
        observation = observations.get(row["id"])
        if (row.get("pointe") or not row["id"].startswith("eb_") or row.get("source") != "enable_banking"
                or not observation):
            continue
        twins = [(twin, other) for twin in pointed.get(_key(row), [])
                 for other in (observations.get(i) for i in twin.get("bankObservationIds", []))
                 if other and other["source"] == "enable_banking" and not other.get("supersededBy")
                 and same_operation_other_shape(observation, other)]
        if not twins:
            continue
        reason = None
        if len(twins) > 1:
            reason = "plusieurs jumelles possibles"
        elif row.get("bankObservationIds") != [row["id"]] or observation.get("bankStatus") != "booked" \
                or observation.get("supersededBy"):
            reason = "observations inattendues"
        elif observation.get("linxoObservationId") or observation.get("enableObservationId"):
            reason = "liée à une notification Linxo"
        elif _user_edited(row):
            reason = "modifiée par l'utilisateur"
        elif row["id"] in approved:
            reason = "approuvée par une récurrence"
        if reason:
            result["skipped"].append({"id": row["id"], "reason": reason})
            continue
        (twin, other), = twins
        result["delete"].append({"id": row["id"], "twinId": twin["id"], "twinObservationId": other["id"],
                                 "row": row, "observation": observation})
    return result


def _delete(store, collection, doc_id):
    if hasattr(store, "remove"):
        store.remove(collection, doc_id)
    else:
        store.db.collection(collection).document(doc_id).delete()


def apply_plan(store, entries, now):
    for entry in entries:
        doc_id = entry["id"]
        store.put("bank_cleanup_backups", doc_id, {
            "transaction": entry["row"], "observation": entry["observation"],
            "twinId": entry["twinId"], "backedUpAt": now, "source": SCRIPT})
        store.put("deleted_transactions", doc_id, {
            "transactionId": doc_id, "deletedAt": now, "deletedBy": SCRIPT, "source": "cleanup_script"})
        store.put("bank_observations", doc_id, {
            "supersededBy": entry["twinObservationId"], "canonicalId": entry["twinId"]})
        _delete(store, "transactions", doc_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Écrit dans Firestore (simulation sinon).")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    from bank_store import BankStore
    from firebase_db import _get_db
    store = BankStore(_get_db())
    found = plan(store)
    log.info("%d doublon(s) sûr(s), %d ligne(s) écartée(s).", len(found["delete"]), len(found["skipped"]))
    for skipped in found["skipped"]:
        log.info("  écartée %s : %s", skipped["id"], skipped["reason"])
    for entry in found["delete"]:
        log.info("  %s -> garde %s", entry["id"], entry["twinId"])
    if not args.apply:
        log.info("[SIMULATION] Aucune écriture. Relancer avec --apply pour supprimer.")
        return
    apply_plan(store, found["delete"], datetime.now(timezone.utc))
    log.info("✓ %d doublon(s) supprimé(s), sauvegardés dans bank_cleanup_backups.", len(found["delete"]))


if __name__ == "__main__":
    main()
