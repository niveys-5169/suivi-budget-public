"""
Scripts/init_account_owners_mapping.py
=====================================

Initialise la configuration Firestore des propriétaires de comptes.

Usage:
  python scripts/init_account_owners_mapping.py

Variables d'environnement requises:
  FIREBASE_CREDENTIALS : Service account Firebase JSON
"""

import json
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from firebase_db import _get_db


def init_account_owners_mapping():
    """Crée ou met à jour la configuration du mapping compte → propriétaire."""
    db = _get_db()
    
    # Configuration : Nicolas est propriétaire de ses deux comptes + par défaut
    # Les épargnes seront détectées par pattern Linxo
    mapping_config = {
        "owners": [
            "Nicolas",
            "Romane"
        ],
        "accounts": {
            "BforBank": "Nicolas",
            "LCL": "Nicolas",
        },
        "savings_patterns": {
            # Modèles pour détecter les propriétaires par le nom Linxo
            # Ex: "Livret Romane" → reconnu comme Romane
            # Ajoute ici si vous avez des noms spécifiques Linxo
            # "Livret Romane": "Romane",
            # "Livret Sienna": "Sienna",
        },
        "default_owner": "Nicolas",
    }
    
    doc_ref = db.collection("metadata").document("account_owners_mapping")
    doc_ref.set(mapping_config)
    
    print("✅ Configuration account_owners_mapping créée/mise à jour dans Firestore")
    print("\nContenu :")
    print(json.dumps(mapping_config, indent=2, ensure_ascii=False))
    
    print("\n" + "="*70)
    print("Pour ajouter des épargnes avec noms spécifiques, modifiez:")
    print("  metadata/account_owners_mapping.savings_patterns dans Firestore")
    print("\nExemple:")
    print('  "Livret Romane": "Romane",')
    print('  "Livret Sienna": "Sienna",')
    print("\nOu lancez ce script à nouveau après modification du mapping.")


if __name__ == "__main__":
    try:
        init_account_owners_mapping()
    except Exception as e:
        print(f"❌ Erreur : {e}", file=sys.stderr)
        sys.exit(1)
