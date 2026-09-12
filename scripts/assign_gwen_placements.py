"""
Scripts/assign_gwen_placements.py
===================================

1. Ajoute "Gwen" à la liste des owners dans metadata/account_owners_mapping
2. Met à jour l'owner des 4 placements Gwen dans la collection `placements`
3. Met à jour l'owner dans `placement_history` pour ces mêmes assets

Usage:
  python scripts/assign_gwen_placements.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Charger les credentials depuis le fichier JSON local si FIREBASE_CREDENTIALS absent
cred_file = os.path.join(os.path.dirname(__file__), '..', 'suivi-budget-credentials.json')
if not os.environ.get('FIREBASE_CREDENTIALS') and os.path.exists(cred_file):
    with open(cred_file, 'r', encoding='utf-8') as f:
        os.environ['FIREBASE_CREDENTIALS'] = f.read()

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from firebase_db import _get_db

# Noms des placements à attribuer à Gwen (recherche insensible à la casse)
GWEN_PLACEMENTS = [
    'livret a gwen',
    'ldds gwen',
    'epargne salariale natixis gwen',
    'epargne salariale amundi gwen',
]


def normalize(s: str) -> str:
    return s.lower().strip()


def main():
    db = _get_db()

    # ─── 1. Ajouter Gwen aux owners ───────────────────────────────────────────
    mapping_ref = db.collection('metadata').document('account_owners_mapping')
    mapping_doc = mapping_ref.get()

    if mapping_doc.exists:
        mapping_data = mapping_doc.to_dict()
        owners = mapping_data.get('owners', [])
        if 'Gwen' not in owners:
            owners.append('Gwen')
            mapping_ref.update({'owners': owners})
            print(f"[OK] Gwen ajoutee aux owners : {owners}")
        else:
            print(f"[--] Gwen deja dans les owners : {owners}")
    else:
        # Creer le document avec les owners par defaut + Gwen
        default_mapping = {
            'owners': ['Nicolas', 'Romane', 'Sienna', 'Gwen', 'Commun'],
            'accounts': {},
            'savings_patterns': {},
            'default_owner': 'Nicolas',
        }
        mapping_ref.set(default_mapping)
        print(f"[OK] Document account_owners_mapping cree avec owners : {default_mapping['owners']}")

    # ─── 2. Mettre à jour les placements ──────────────────────────────────────
    placements_ref = db.collection('placements')
    all_placements = placements_ref.stream()

    updated_ids = []
    for doc in all_placements:
        data = doc.to_dict()
        nom = data.get('nom', '')
        if normalize(nom) in GWEN_PLACEMENTS:
            placements_ref.document(doc.id).update({'owner': 'Gwen'})
            updated_ids.append(doc.id)
            print(f"[OK] Placement mis a jour : [{doc.id}] {nom!r} -> owner=Gwen")

    if not updated_ids:
        print("[WARN] Aucun placement trouve correspondant aux noms Gwen.")
        print("    Placements existants :")
        for doc in placements_ref.stream():
            print(f"      - {doc.to_dict().get('nom', '(sans nom)')!r}")
        return

    # ─── 3. Mettre à jour placement_history ───────────────────────────────────
    history_ref = db.collection('placement_history')
    history_docs = history_ref.stream()

    history_updated = 0
    for doc in history_docs:
        data = doc.to_dict()
        asset_id = data.get('assetId', '')
        # Cherche par assetId ou par nom
        nom = data.get('nom', '')
        if asset_id in updated_ids or normalize(nom) in GWEN_PLACEMENTS:
            history_ref.document(doc.id).update({'owner': 'Gwen'})
            history_updated += 1

    print(f"\n[OK] {history_updated} entree(s) placement_history mises a jour -> owner=Gwen")
    print("\n[DONE] Termine. Rafraichis l'app pour voir les changements.")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"❌ Erreur : {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
