"""
scripts/cleanup_duplicate_ids.py — Nettoyage des doublons du 28/07/2026.
========================================================================

Contexte
--------
La PR #701 a préfixé `_transaction_id` par le compte. L'ID d'une transaction
déjà en base changeait donc, et le préchargement ne résolvait plus le document
existant : `sauvegarder_transactions` écrivait un SECOND document (avec
`pointe=False`) au lieu de fusionner.

Combiné au « Scanner tout » (qui rejoue tous les mails Linxo alors que la dédup
ne voyait que 60 jours), le run du 28/07 15:26 a créé ~286 doublons non pointés.

Ce script les supprime. La règle :

    supprimer un document UNIQUEMENT si son ID est au format préfixé-compte
    ET qu'il existe un document au format hérité PORTANT LE MÊME COMPTE à
    l'ID hérité déterministe (date, libelle-du-doublon, montant).

Le libellé du jumeau n'est volontairement PAS comparé à celui du doublon :
l'ID hérité encode le libellé D'ORIGINE (celui du premier import), alors que
l'utilisateur a pu renommer le champ `libelle` du jumeau depuis (l'import
préserve un renommage sans jamais recalculer l'ID du document). Exiger
l'égalité texte du libellé aurait raté les doublons dont l'original avait
été renommé manuellement dans l'app — près d'un tiers des doublons réels de
l'incident (101 sur 271) étaient dans ce cas.

Les transactions réellement nouvelles (ex. celles du 27/07 récupérées) n'ont pas
de jumeau hérité : elles sont CONSERVÉES.

Avant suppression, tout travail utilisateur porté par le doublon (pointe,
commentaire, moisAffectation) et absent du jumeau est reporté sur le jumeau.

Usage :
    python scripts/cleanup_duplicate_ids.py                 # dry-run (défaut)
    python scripts/cleanup_duplicate_ids.py --apply
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import (
    _get_db,
    _legacy_transaction_id,
    _transaction_id,
    is_firebase_available,
    supprimer_transactions_par_ids,
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

# Les IDs préfixés-compte n'existent que depuis le merge de la PR #701.
DEFAULT_SINCE_IMPORTED = "2026-07-28T15:25:00Z"

# Champs de travail utilisateur à ne jamais perdre.
USER_FIELDS = ("pointe", "commentaire", "moisAffectation")


def _a_du_travail_utilisateur(data: dict) -> dict:
    """Champs utilisateur non vides portés par un document."""
    porte = {}
    if data.get("pointe"):
        porte["pointe"] = True
    if str(data.get("commentaire", "")).strip():
        porte["commentaire"] = data["commentaire"]
    if str(data.get("moisAffectation", "")).strip():
        porte["moisAffectation"] = data["moisAffectation"]
    return porte


def _charger_transactions(db) -> dict:
    """Charge {doc_id: data} pour toute la collection transactions."""
    docs = {}
    for snap in db.collection("transactions").stream():
        docs[snap.id] = snap.to_dict() or {}
    return docs


def analyser(docs: dict, since_imported: datetime | None) -> tuple[list, list, dict]:
    """Sépare les documents en (doublons_a_supprimer, prefixes_conserves, reports).

    `reports` : {legacy_id: {champs à reporter}} pour le travail utilisateur
    présent sur le doublon mais absent du jumeau.
    """
    doublons, conserves, reports = [], [], {}

    for doc_id, data in docs.items():
        date_str = str(data.get("date", "")).strip()
        libelle = str(data.get("libelle", "")).strip()
        compte = str(data.get("compte", "")).strip()
        montant = data.get("montant")
        if not date_str or not libelle or montant is None or not compte:
            continue

        try:
            date_obj = datetime.strptime(date_str[:10], "%Y-%m-%d")
            attendu_prefixe = _transaction_id(compte, date_obj, libelle, float(montant))
            attendu_legacy = _legacy_transaction_id(date_obj, libelle, float(montant))
        except (TypeError, ValueError):
            continue

        # Ne cibler que les documents au format préfixé-compte.
        if doc_id != attendu_prefixe:
            continue

        # Double sécurité : ne toucher qu'aux documents écrits depuis l'incident.
        if since_imported is not None:
            imported_at = data.get("importedAt")
            if isinstance(imported_at, datetime):
                ts = imported_at if imported_at.tzinfo else imported_at.replace(tzinfo=timezone.utc)
                if ts < since_imported:
                    conserves.append(doc_id)
                    continue

        # Un jumeau au format hérité doit exister, sur le MÊME compte.
        #
        # On ne compare PAS le libellé du jumeau à celui du doublon : l'ID
        # hérité encode déjà le libellé D'ORIGINE (celui du premier import),
        # alors que l'utilisateur a pu renommer le champ `libelle` du jumeau
        # depuis (editable_fields préserve le renommage sans jamais recalculer
        # l'ID). Exiger l'égalité du libellé ratait donc les doublons dont
        # l'original avait été renommé manuellement dans l'app — vérifié en
        # production : 101 des 271 doublons réels de l'incident portaient un
        # libellé d'origine renommé par l'utilisateur. `attendu_legacy` étant
        # une fonction déterministe de (date, libellé-du-doublon, montant), le
        # simple fait qu'un document existe à cet ID est déjà une preuve
        # d'identité suffisante ; on ne vérifie plus que le compte, pour
        # continuer à exclure la collision inter-comptes (cf. tests).
        jumeau = docs.get(attendu_legacy)
        if jumeau is None or str(jumeau.get("compte", "")).strip() != compte:
            conserves.append(doc_id)
            continue

        # Reporter le travail utilisateur porté par le doublon et absent du jumeau.
        porte = _a_du_travail_utilisateur(data)
        manquant = {k: v for k, v in porte.items() if not jumeau.get(k)}
        if manquant:
            reports[attendu_legacy] = manquant

        doublons.append(doc_id)

    return doublons, conserves, reports


def main():
    parser = argparse.ArgumentParser(description="Supprime les doublons d'ID du 28/07/2026.")
    parser.add_argument("--apply", action="store_true", help="Applique réellement les suppressions.")
    parser.add_argument(
        "--since-imported",
        default=DEFAULT_SINCE_IMPORTED,
        help="Ne traiter que les docs importés après cette date ISO (défaut : %(default)s). "
             "Passer 'none' pour désactiver ce filtre.",
    )
    args = parser.parse_args()

    if not is_firebase_available():
        log.error("FIREBASE_CREDENTIALS non défini.")
        sys.exit(1)

    since = None
    if args.since_imported.lower() != "none":
        since = datetime.fromisoformat(args.since_imported.replace("Z", "+00:00"))

    db = _get_db()
    log.info("Chargement de la collection transactions...")
    docs = _charger_transactions(db)
    log.info(f"{len(docs)} transactions chargées.")

    doublons, conserves, reports = analyser(docs, since)

    log.info(f"Documents au format préfixé-compte conservés (pas de jumeau) : {len(conserves)}")
    log.info(f"Doublons identifiés (jumeau hérité de contenu identique)     : {len(doublons)}")
    for doc_id in doublons[:10]:
        d = docs[doc_id]
        log.info(f"  - {doc_id}  ({d.get('date')} {d.get('libelle')} {d.get('montant')})")
    if len(doublons) > 10:
        log.info(f"  … et {len(doublons) - 10} autres.")

    if reports:
        log.info(f"{len(reports)} document(s) hérité(s) recevront du travail utilisateur du doublon :")
        for legacy_id, champs in list(reports.items())[:10]:
            log.info(f"  - {legacy_id} <- {champs}")

    if not args.apply:
        log.info("")
        log.info("DRY-RUN : rien n'a été modifié. Relancer avec --apply pour appliquer.")
        return

    if reports:
        log.info("Report du travail utilisateur vers les documents hérités...")
        batch = db.batch()
        for i, (legacy_id, champs) in enumerate(reports.items(), start=1):
            batch.set(db.collection("transactions").document(legacy_id), champs, merge=True)
            if i % 500 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
        log.info(f"{len(reports)} document(s) mis à jour.")

    supprimes = supprimer_transactions_par_ids(doublons)
    log.info(f"{supprimes} doublon(s) supprimé(s).")
    log.info(f"Total transactions attendu : {len(docs)} -> {len(docs) - supprimes}")


if __name__ == "__main__":
    main()
