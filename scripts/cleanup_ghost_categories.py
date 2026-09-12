"""
scripts/cleanup_ghost_categories.py — Nettoyage définitif des catégories fantômes (Auto-IDs).
==========================================================================================

Ce script assainit la collection 'budgets' en :
1. Identifiant les documents ayant un Auto-ID technique (ex: 0CcjuwS1Fo4ANG3CaEIK).
2. Vérifiant s'ils contiennent un nom de catégorie valide.
3. Supprimant les doublons techniques pour ne garder que des documents nommés par leur catégorie.
"""

import sys
import os
import re
import logging

# S'assurer que le répertoire src est dans le path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import _get_db

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)

def is_technical_id(doc_id):
    """Détecte les Auto-IDs Firestore (20 caractères alphanumériques)."""
    return len(doc_id) == 20 and re.match(r'^[a-zA-Z0-9]+$', doc_id)

def cleanup():
    try:
        db = _get_db()
    except Exception as e:
        log.error(f"Erreur initialisation Firestore : {e}")
        return

    log.info("--- Début du nettoyage des catégories fantômes ---")

    budgets_col = db.collection("budgets")
    docs = list(budgets_col.stream())
    
    log.info(f"Analyse de {len(docs)} documents dans la collection 'budgets'...")

    deleted_count = 0
    renamed_count = 0

    for doc in docs:
        doc_id = doc.id
        data = doc.to_dict()
        
        if is_technical_id(doc_id):
            category_name = data.get("categorie") or data.get("nom")
            
            if not category_name:
                log.warning(f"Document {doc_id} est un ID technique sans nom de catégorie. SUPPRESSION.")
                doc.reference.delete()
                deleted_count += 1
                continue
            
            # Si on a un nom de catégorie, on vérifie si un document "propre" existe déjà
            clean_doc_ref = budgets_col.document(category_name)
            clean_doc = clean_doc_ref.get()
            
            if clean_doc.exists:
                log.info(f"Doublon trouvé : {doc_id} -> {category_name}. Le document propre existe déjà. SUPPRESSION du technique.")
                doc.reference.delete()
                deleted_count += 1
            else:
                log.info(f"Redressement : {doc_id} -> Création du document propre '{category_name}'.")
                # On crée le nouveau document avec les données
                clean_doc_ref.set(data)
                # On supprime l'ancien
                doc.reference.delete()
                renamed_count += 1

    log.info(f"--- Nettoyage terminé ---")
    log.info(f"Documents supprimés : {deleted_count}")
    log.info(f"Documents redressés : {renamed_count}")
    log.info("Votre liste de catégories devrait maintenant être propre.")

if __name__ == "__main__":
    cleanup()
