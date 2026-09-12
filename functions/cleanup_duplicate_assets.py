"""
Nettoyage des doublons d'actifs dans placement_history.

Supprime les entrées "Commun" obsolètes qui causent des doublons dans la liste d'actifs.
- Livret_A__x328C_ (Commun) → à supprimer
- Livret Dév. Durable et Solidaire (x528R) (Commun) → à supprimer
"""

from firebase_admin import credentials, initialize_app, firestore
from datetime import datetime
import logging

log = logging.getLogger(__name__)


def cleanup_duplicate_assets():
    """Supprime les entrées placement_history avec owner='Commun' pour les livrets."""
    db = firestore.client()

    # AssetIds à nettoyer (les vieilles entrées "Commun")
    assets_to_clean = [
        "livret_Livret_A__x328C_",  # Old sanitize format → should not exist anymore
        "livret_Livret_Dv__Durable_et_Solidaire__x528R_",  # Old sanitize format
    ]

    deleted_count = 0

    for asset_id in assets_to_clean:
        # Récupère tous les docs avec cet assetId et owner="Commun"
        docs = (
            db.collection("placement_history")
            .where("assetId", "==", asset_id)
            .where("owner", "==", "Commun")
            .stream()
        )

        for doc in docs:
            print(f"  Suppression: {doc.id} → {doc.get('nom')} (owner=Commun)")
            doc.reference.delete()
            deleted_count += 1

    print(f"\n✅ {deleted_count} entrées supprimées de placement_history")
    return deleted_count


if __name__ == "__main__":
    # Initialiser Firebase
    cred = credentials.Certificate("serviceAccountKey.json")
    initialize_app(cred)

    cleanup_duplicate_assets()
