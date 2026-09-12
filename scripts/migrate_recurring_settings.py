"""
scripts/migrate_recurring_settings.py — recurring_expense_settings -> recurrences
===================================================================================

Phase 4 du plan d'unification des récurrences
(docs/plans/2026-07-02-recurrences-unified-design.md).

Ce script effectue les opérations suivantes :
1. Sauvegarde recurring_expense_settings dans une collection de backup horodatée.
2. Pour chaque document `status == 'accepted'` :
   - Sans montant exploitable (customAmount/manualAmount absents — le cas de la
     majorité des candidats détectés automatiquement, dont label/catégorie/
     avgAmount ne sont JAMAIS persistés en base, seulement recalculés à la
     volée côté app), le document est laissé de côté : il réapparaîtra comme
     suggestion dans la nouvelle UI, sur les mêmes transactions.
   - S'il existe déjà une récurrence active dont un alias correspond au libellé
     normalisé, le document est ignoré (idempotence — relancer le script ne
     duplique rien).
   - Sinon, crée un document dans `recurrences` (source: 'auto'), en reprenant
     montant/catégorie/alias (libellé dérivé de la clé si absent), les liens
     mensuels (monthOverrides.linkedTxId -> approvedMonths) et les mois ignorés
     (monthOverrides.skipped -> skippedPeriods).
3. Pour chaque document `status == 'rejected'`, ajoute sa clé à
   settings/recurrenceSuggestions.ignoredKeys pour qu'il ne réapparaisse pas
   comme suggestion détectée automatiquement.

Les documents `status == 'pending'` ne sont NI migrés NI ignorés : ils
réapparaîtront naturellement comme suggestions dans la nouvelle UI, où
l'utilisateur choisit d'accepter ou d'ignorer.

Ce script ne supprime ni ne modifie recurring_expense_settings — la collection
n'est gelée (lecture seule) qu'à l'issue de la Phase 5, jamais ici.

Usage :
    python scripts/migrate_recurring_settings.py --dry-run   # simulation, aucune écriture
    python scripts/migrate_recurring_settings.py             # migration réelle
"""

import argparse
import logging
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from firebase_db import _get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)


def normalize_label(label: str) -> str:
    """Équivalent Python de public/src/hooks/recurringService.ts::normalizeLabel."""
    if not label:
        return ''
    s = label.lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s.replace(' ', '-')


def migrate(dry_run: bool = False) -> None:
    try:
        db = _get_db()
    except Exception as e:
        log.error(f"Erreur initialisation Firestore : {e}")
        return

    log.info("--- Début de la migration recurring_expense_settings -> recurrences ---")
    if dry_run:
        log.info("Mode DRY-RUN : aucune écriture ne sera effectuée.")

    source_docs = list(db.collection("recurring_expense_settings").stream())
    log.info(f"{len(source_docs)} documents trouvés dans recurring_expense_settings.")

    # 1. Backup (avant toute écriture)
    if not dry_run and source_docs:
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        backup_col = f"recurring_expense_settings_backup_{now_str}"
        log.info(f"Backup dans la collection {backup_col}...")
        batch = db.batch()
        for doc in source_docs:
            ref = db.collection(backup_col).document(doc.id)
            batch.set(ref, doc.to_dict())
        batch.commit()
        log.info("Backup terminé.")

    # 2. Alias déjà couverts par une récurrence active existante (idempotence)
    existing_recurrences = list(
        db.collection("recurrences").where(filter=FieldFilter("active", "==", True)).stream()
    )
    existing_aliases = set()
    for doc in existing_recurrences:
        for alias in doc.to_dict().get("aliases") or []:
            existing_aliases.add(alias)

    created = 0
    skipped_existing = 0
    skipped_no_amount = 0
    ignored_keys_to_add = []

    for doc in source_docs:
        data = doc.to_dict()
        key = doc.id
        status = data.get("status")

        if status == "rejected":
            ignored_keys_to_add.append(key)
            continue

        if status != "accepted":
            continue  # 'pending' : laissé de côté, réapparaîtra comme suggestion

        # Le montant (customAmount/manualAmount) est la seule donnée réellement
        # persistée pour un candidat "accepted" — label/catégorie/avgAmount sont
        # recalculés à la volée côté app depuis l'historique des transactions et
        # n'existent JAMAIS dans le document Firestore. Sans montant exploitable,
        # il n'y a rien à migrer : le candidat réapparaîtra comme suggestion dans
        # la nouvelle UI (mêmes transactions sous-jacentes, toujours présentes).
        amount = data.get("customAmount")
        if amount is None:
            amount = data.get("manualAmount")
        if not amount:
            log.info(
                f"[{key}] Aucun montant exploitable (customAmount/manualAmount absents) "
                f"— laissé de côté, réapparaîtra comme suggestion."
            )
            skipped_no_amount += 1
            continue
        expected_amount = -abs(float(amount))

        raw_label = data.get("customLabel") or data.get("label")
        if raw_label:
            label = raw_label
        else:
            # Libellé lisible dérivé de la clé (slug ou "catégorie||montant" legacy).
            label = key.split("||")[0].replace("-", " ").strip().title() or key
        normalized = normalize_label(label)

        if normalized and normalized in existing_aliases:
            log.info(
                f"[{key}] '{label}' déjà couvert par une récurrence existante "
                f"(alias '{normalized}') — ignoré."
            )
            skipped_existing += 1
            continue

        category = data.get("customCategory") or data.get("category") or "Inconnu"

        month_overrides = data.get("monthOverrides") or {}
        approved_months = {}
        skipped_periods = []

        for month_key, override in month_overrides.items():
            if not isinstance(override, dict):
                continue
            if override.get("skipped"):
                skipped_periods.append(month_key)
            elif override.get("linkedTxId"):
                approved_months[month_key] = {
                    "txId": override["linkedTxId"],
                    "amount": override.get("linkedAmount", expected_amount),
                    "date": override.get("linkedDate", f"{month_key}-01"),
                    "approvedAt": int(datetime.now(timezone.utc).timestamp() * 1000),
                }

        last_seen = data.get("lastSeen") or ""
        if last_seen:
            anchor_date = last_seen[:10]
        elif approved_months:
            anchor_date = max(a["date"] for a in approved_months.values())
        else:
            anchor_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        try:
            day_of_month = int(anchor_date.split("-")[2])
        except (IndexError, ValueError):
            day_of_month = 1

        aliases = sorted(
            {normalized}
            | {normalize_label(a) for a in (data.get("aliases") or [])} - {''}
        )

        new_recurrence = {
            "label": label,
            "category": category,
            "expectedAmount": expected_amount,
            "dayOfMonth": day_of_month,
            "frequency": "monthly",
            "anchorDate": anchor_date,
            "aliases": aliases,
            "source": "auto",
            "active": True,
            "approvedMonths": approved_months,
            "skippedPeriods": skipped_periods,
        }

        log.info(
            f"[{key}] Migration -> '{label}' ({expected_amount} €, "
            f"{len(approved_months)} mois liés, {len(skipped_periods)} ignoré(s))"
        )

        if not dry_run:
            new_recurrence["createdAt"] = firestore.SERVER_TIMESTAMP
            db.collection("recurrences").add(new_recurrence)

        # Mis à jour même en dry-run : deux candidats du même lot partageant un
        # alias ne doivent être comptés qu'une fois, pour que l'aperçu soit fidèle
        # au résultat réel (où le second serait bloqué par l'idempotence).
        existing_aliases.update(aliases)

        created += 1

    if ignored_keys_to_add:
        log.info(f"{len(ignored_keys_to_add)} suggestion(s) rejetée(s) à ignorer : {ignored_keys_to_add}")
        if not dry_run:
            db.collection("settings").document("recurrenceSuggestions").set(
                {"ignoredKeys": firestore.ArrayUnion(ignored_keys_to_add)}, merge=True
            )

    log.info(
        f"--- Migration terminée : {created} récurrence(s) créée(s), "
        f"{skipped_existing} déjà présente(s), "
        f"{skipped_no_amount} sans montant exploitable (réapparaîtront comme suggestions), "
        f"{len(ignored_keys_to_add)} clé(s) ignorée(s) ajoutée(s) ---"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migre recurring_expense_settings (accepted/rejected) vers recurrences / ignoredKeys."
    )
    parser.add_argument("--dry-run", action="store_true", help="Simule sans écrire dans Firestore.")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)
