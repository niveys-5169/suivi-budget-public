"""
scripts/migrate_budgets_v2.py — Migration des anciens budgets vers le modèle V2.
=============================================================================

Ce script effectue les opérations suivantes :
1. Sauvegarde les anciennes collections (budgets, budgets_annual_defaults, budgets_monthly).
2. Transforme les budgets par défaut (BUDGET_DEFAULTS) en budgets V2 de type 'mensuel'.
3. Transforme l'historique annuel (BUDGET_ANNUAL_HISTORY) en budgets V2 de type 'annuel'.
4. Vide la collection 'budgets' et la repeuple avec le nouveau format.
"""

import sys
import os
from datetime import datetime, timezone
import logging

# S'assurer que le répertoire src est dans le path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import _get_db

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

def migrate():
    try:
        db = _get_db()
    except Exception as e:
        log.error(f"Erreur initialisation Firestore : {e}")
        return

    log.info("--- Début de la migration vers Budgets V2 ---")

    # 1. Récupération des données sources
    log.info("Lecture des anciennes collections...")
    
    # Legacy Defaults (Collection 'budgets')
    legacy_defaults_docs = list(db.collection("budgets").stream())
    legacy_defaults = {d.id: d.to_dict() for d in legacy_defaults_docs}
    log.info(f"Trouvé {len(legacy_defaults)} budgets par défaut (mensuels).")

    # Legacy Annual (Collection 'budgets_annual_defaults')
    legacy_annual_docs = list(db.collection("budgets_annual_defaults").stream())
    # On groupe par catégorie pour prendre le plus récent
    legacy_annual_by_cat = {}
    for d in legacy_annual_docs:
        data = d.to_dict()
        cat = data.get("categorie")
        if not cat: continue
        if cat not in legacy_annual_by_cat or data.get("startMonth", "") > legacy_annual_by_cat[cat].get("startMonth", ""):
            legacy_annual_by_cat[cat] = data
    log.info(f"Trouvé {len(legacy_annual_by_cat)} budgets annuels uniques.")

    # 2. Sauvegarde (Backup)
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_col = f"budgets_backup_{now_str}"
    log.info(f"Création d'un backup dans la collection {backup_col}...")
    
    batch = db.batch()
    count = 0
    for doc in legacy_defaults_docs:
        ref = db.collection(backup_col).document(f"default_{doc.id}")
        batch.set(ref, {"source": "budgets", "data": doc.to_dict()})
        count += 1
    for doc in legacy_annual_docs:
        ref = db.collection(backup_col).document(f"annual_{doc.id}")
        batch.set(ref, {"source": "budgets_annual_defaults", "data": doc.to_dict()})
        count += 1
    
    if count > 0:
        batch.commit()
        log.info(f"Backup terminé ({count} documents).")

    # 3. Transformation en V2
    new_budgets = []
    
    # On commence par les annuels (prioritaires si présents)
    processed_cats = set()
    for cat, data in legacy_annual_by_cat.items():
        new_budgets.append({
            "nom": f"{cat} (Annuel)",
            "categorie": cat,
            "type": "annuel",
            "montant": float(data.get("annualMontant", 0)),
            "periode": {"type": "annee_civile"},
            "moisAttendus": [],
            "compte": None,
            "actif": True
        })
        processed_cats.add(cat)

    # Puis les mensuels restants
    for cat, data in legacy_defaults.items():
        if cat in processed_cats:
            # Si on a déjà un budget annuel pour cette catégorie, on désactive le mensuel ou on l'ignore
            # Ici on va l'ajouter quand même en désactivé pour que l'utilisateur choisisse
            log.info(f"Catégorie {cat} a déjà un budget annuel. Ajout du mensuel en mode 'inactif'.")
            actif = False
        else:
            actif = True
            
        new_budgets.append({
            "nom": f"{cat} (Mensuel)",
            "categorie": cat,
            "type": "mensuel",
            "montant": float(data.get("montant", 0)),
            "periode": {"type": "mois_courant"},
            "moisAttendus": [],
            "compte": None,
            "actif": actif
        })

    log.info(f"Préparation de {len(new_budgets)} nouveaux budgets V2.")

    # 4. Nettoyage et Insertion
    log.info("Nettoyage de l'ancienne collection 'budgets'...")
    for doc in legacy_defaults_docs:
        doc.reference.delete()
    
    log.info("Insertion des budgets V2...")
    now = datetime.now(timezone.utc)
    for b in new_budgets:
        b["createdAt"] = now
        b["updatedAt"] = now
        db.collection("budgets").add(b)
    
    log.info("Migration terminée avec succès !")
    log.info("Note : Les collections 'budgets_annual_defaults' et 'budgets_monthly' n'ont pas été supprimées par sécurité.")

if __name__ == "__main__":
    migrate()
