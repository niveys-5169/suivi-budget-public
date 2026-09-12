"""
scripts/cleanup_duplicate_categories.py — Fusion des catégories de budget en doublon.
=====================================================================================

Certaines enveloppes apparaissent en double parce que leur libellé `categorie`
diffère par une casse, un accent, un espace de bord ou un encodage Unicode (NFC/NFD)
— ex. "Santé" vs "santé" vs "Santé ". Ces variantes ne sont pas dédupliquées côté
app car les comparaisons y sont (historiquement) exactes.

Ce script groupe les documents de la collection 'budgets' par clé canonique
(miroir exact de `normalizeSearchValue` + trim côté front : minuscule + suppression
des accents). Pour chaque groupe de plus d'un document, il conserve le document
"canonique" (priorité au montant > 0, puis à l'id égal au nom de catégorie) et
supprime les autres.

Sûr et idempotent : lancé une seconde fois, plus aucun groupe n'a de doublon.

Usage :
    python scripts/cleanup_duplicate_categories.py            # dry-run (aucune écriture)
    python scripts/cleanup_duplicate_categories.py --apply    # applique les suppressions
"""

import sys
import os
import argparse
import logging
import unicodedata

# S'assurer que le répertoire src est dans le path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import _get_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)


def category_key(name):
    """Clé canonique d'une catégorie. Miroir de normalizeSearchValue + trim côté front
    (minuscule, NFD, suppression des marques combinantes / accents)."""
    s = (name or '').strip().lower()
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


def score(data, doc_id):
    """Préférence du document à conserver : montant > 0 d'abord, puis id == catégorie."""
    montant = data.get('montant') or 0
    s = 2 if (isinstance(montant, (int, float)) and montant > 0) else 0
    cat = data.get('categorie') or data.get('nom') or ''
    if doc_id == cat:  # miroir de budgetDocKey pour les noms sans '/'
        s += 1
    return s


def cleanup(apply):
    try:
        db = _get_db()
    except Exception as e:
        log.error(f"Erreur initialisation Firestore : {e}")
        return

    log.info("--- Début de la fusion des catégories en doublon ---")

    docs = list(db.collection('budgets').stream())
    log.info(f"Analyse de {len(docs)} documents dans la collection 'budgets'...")

    groups = {}
    for d in docs:
        data = d.to_dict() or {}
        key = category_key(data.get('categorie') or data.get('nom') or d.id)
        groups.setdefault(key, []).append((d, data))

    deleted = 0
    for key, members in groups.items():
        if len(members) <= 1:
            continue
        members.sort(key=lambda m: score(m[1], m[0].id), reverse=True)
        keeper, keeper_data = members[0]
        log.info(
            f"Groupe '{key}' : conservation de '{keeper.id}' "
            f"(categorie={keeper_data.get('categorie')!r}, montant={keeper_data.get('montant')})."
        )
        for d, data in members[1:]:
            action = 'SUPPRESSION' if apply else '[dry-run] suppression prévue'
            log.info(
                f"  {action} de '{d.id}' "
                f"(categorie={data.get('categorie')!r}, montant={data.get('montant')})."
            )
            if apply:
                d.reference.delete()
                deleted += 1

    log.info("--- Terminé ---")
    if apply:
        log.info(f"Documents supprimés : {deleted}")
    else:
        log.info("Dry-run : aucune écriture. Relancez avec --apply pour appliquer.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Applique réellement les suppressions (par défaut : dry-run).',
    )
    args = parser.parse_args()
    cleanup(args.apply)
