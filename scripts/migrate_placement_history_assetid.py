#!/usr/bin/env python3
"""
Migration : ajoute le champ canonique 'assetId' aux documents placement_history existants.

Ce script NE SUPPRIME RIEN. Il lit chaque document, déduit l'assetId correct depuis
l'ID du document ou les champs existants, et met à jour le document sur place.
Les documents écrits par l'ancien writer Python (champ 'id' au lieu de 'assetId')
sont également recréés avec le bon ID normalisé (YYYY-MM-DD au lieu de YYYYMMDD).

Usage :
    python scripts/migrate_placement_history_assetid.py --credentials path/to/service-account.json

    ou avec Application Default Credentials (si gcloud auth application-default login fait) :
    python scripts/migrate_placement_history_assetid.py
"""

import argparse
import re
import sys
from google.oauth2 import service_account
import google.auth
import google.auth.transport.requests
import requests as http_requests
import json

PROJECT_ID = "suivi-budget-ab888"
COLLECTION = "placement_history"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"


def get_token(creds_file: str | None) -> str:
    if creds_file:
        creds = service_account.Credentials.from_service_account_file(
            creds_file,
            scopes=["https://www.googleapis.com/auth/datastore"],
        )
    else:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/datastore"])
    auth_req = google.auth.transport.requests.Request()
    creds.refresh(auth_req)
    return creds.token


def normalize_asset_id(raw: str) -> str:
    """Normalise un assetId : remplace tout caractère non [a-zA-Z0-9_] par _.
    Utilise ASCII strict (pas unicode) pour être identique à la convention
    du Python Cloud Function qui fait c.isalnum() en ASCII.
    Ex: 'livret_Livret A (x328C)' → 'livret_Livret_A__x328C_'
    Ex: 'livret_Livret Dév. Durable' → 'livret_Livret_D_v__Durable'
    """
    return re.sub(r"[^a-zA-Z0-9_]", "_", raw)


def extract_asset_id(doc_id: str, data: dict) -> str:
    """Déduit l'assetId canonique depuis l'ID du document ou les champs existants."""
    raw_id = data.get("assetId") or data.get("placementId")
    
    if not raw_id:
        # Ancien writer Python : champ 'id' absent, déduire depuis le doc ID
        raw_id = re.sub(r"_\d{4}-\d{2}-\d{2}$", "", doc_id)  # YYYY-MM-DD
        raw_id = re.sub(r"_\d{8}$", "", raw_id)              # YYYYMMDD
    
    if raw_id == "portefeuille":
        return "portefeuille_boursier"
        
    # Si l'ID a déjà un préfixe correct, on le garde
    if raw_id.startswith(("livret_", "courant_", "portfolio_", "portefeuille_")):
        return normalize_asset_id(raw_id)
        
    # Sinon, on déduit le préfixe selon le type
    type_val = str(data.get("type", "")).lower()
    if type_val in ("savings", "épargne", "epargne"):
        return f"livret_{normalize_asset_id(raw_id)}"
    if type_val in ("cash", "courants", "liquidités", "liquidites", "courant"):
        return f"courant_{normalize_asset_id(raw_id)}"
        
    # Par défaut (ou placements manuels), on garde l'ID tel quel (Auto-ID ou slug)
    return normalize_asset_id(raw_id)


def normalized_doc_id(asset_id: str, date_str: str) -> str:
    """Retourne l'ID normalisé : {assetId}_{YYYY-MM-DD}.
    L'assetId est lui-même normalisé (pas d'espaces ni caractères spéciaux).
    """
    safe_id = normalize_asset_id(asset_id)
    return f"{safe_id}_{date_str}"


def firestore_value_to_python(v: dict):
    """Convertit une valeur Firestore REST en valeur Python."""
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return float(v["doubleValue"])
    if "booleanValue" in v:
        return v["booleanValue"]
    if "nullValue" in v:
        return None
    if "timestampValue" in v:
        return v["timestampValue"]
    if "mapValue" in v:
        return {k: firestore_value_to_python(vv) for k, vv in v["mapValue"].get("fields", {}).items()}
    if "arrayValue" in v:
        return [firestore_value_to_python(i) for i in v["arrayValue"].get("values", [])]
    return None


def python_to_firestore_value(v) -> dict:
    """Convertit une valeur Python en valeur Firestore REST."""
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        # Detect timestamp strings
        if re.match(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", v):
            return {"timestampValue": v}
        return {"stringValue": v}
    if isinstance(v, dict):
        return {"mapValue": {"fields": {k: python_to_firestore_value(vv) for k, vv in v.items()}}}
    if isinstance(v, list):
        return {"arrayValue": {"values": [python_to_firestore_value(i) for i in v]}}
    return {"stringValue": str(v)}


def list_all_docs(token: str) -> list[dict]:
    """Récupère tous les documents de la collection placement_history."""
    docs = []
    page_token = None
    headers = {"Authorization": f"Bearer {token}"}
    while True:
        params = {"pageSize": 300}
        if page_token:
            params["pageToken"] = page_token
        r = http_requests.get(f"{BASE_URL}/{COLLECTION}", headers=headers, params=params)
        r.raise_for_status()
        data = r.json()
        docs.extend(data.get("documents", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return docs


def patch_doc(token: str, doc_id: str, fields: dict):
    """Met à jour uniquement le champ assetId d'un document existant."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{BASE_URL}/{COLLECTION}/{doc_id}"
    body = {
        "fields": {k: python_to_firestore_value(v) for k, v in fields.items()}
    }
    # updateMask pour ne modifier que les champs spécifiés
    field_paths = ",".join(fields.keys())
    r = http_requests.patch(url, headers=headers, json=body, params={"updateMask.fieldPaths": list(fields.keys())})
    r.raise_for_status()


def create_doc(token: str, doc_id: str, fields: dict):
    """Crée ou remplace un document avec l'ID donné."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"{BASE_URL}/{COLLECTION}/{doc_id}"
    body = {"fields": {k: python_to_firestore_value(v) for k, v in fields.items()}}
    r = http_requests.patch(url, headers=headers, json=body)
    r.raise_for_status()


def delete_doc(token: str, doc_id: str):
    headers = {"Authorization": f"Bearer {token}"}
    r = http_requests.delete(f"{BASE_URL}/{COLLECTION}/{doc_id}", headers=headers)
    r.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description="Migrate placement_history to unified assetId field")
    parser.add_argument("--credentials", help="Chemin vers le fichier service account JSON du projet suivi-budget-ab888")
    parser.add_argument("--dry-run", action="store_true", help="Afficher les changements sans les appliquer")
    args = parser.parse_args()

    print(f"Projet : {PROJECT_ID}")
    print(f"Collection : {COLLECTION}")
    print(f"Mode : {'DRY-RUN' if args.dry_run else 'LIVE'}\n")

    token = get_token(args.credentials)
    print("Token obtenu. Chargement des documents...")

    docs = list_all_docs(token)
    print(f"{len(docs)} documents trouvés.\n")

    already_ok = 0
    patched = 0
    renamed = 0
    errors = 0

    for doc in docs:
        doc_id = doc["name"].split("/")[-1]
        raw_fields = doc.get("fields", {})
        data = {k: firestore_value_to_python(v) for k, v in raw_fields.items()}

        asset_id = extract_asset_id(doc_id, data)
        date_str = data.get("date", "")

        # Vérifier si le doc_id est au bon format
        expected_id = normalized_doc_id(asset_id, date_str) if date_str else None
        needs_rename = expected_id and doc_id != expected_id

        if data.get("assetId") == asset_id and not needs_rename:
            already_ok += 1
            continue

        print(f"{'[DRY]' if args.dry_run else '[FIX]'} {doc_id}")
        if data.get("assetId") != asset_id:
            print(f"       assetId: {data.get('assetId', data.get('placementId', data.get('id', '(absent)')))} → {asset_id}")
        if needs_rename:
            print(f"       doc ID:  {doc_id} → {expected_id}")

        if args.dry_run:
            continue

        try:
            if needs_rename:
                # Créer nouveau doc avec ID normalisé, supprimer l'ancien
                new_data = {**data, "assetId": asset_id}
                # Retirer l'ancien champ 'id' s'il était là (ancien writer Python)
                new_data.pop("id", None)
                new_data.pop("placementId", None)
                create_doc(token, expected_id, new_data)
                delete_doc(token, doc_id)
                renamed += 1
            else:
                # Juste ajouter/corriger le champ assetId
                patch_doc(token, doc_id, {"assetId": asset_id})
                patched += 1
        except Exception as e:
            print(f"  ERREUR: {e}")
            errors += 1

    print(f"\n{'=' * 50}")
    print(f"Déjà corrects    : {already_ok}")
    print(f"Champ ajouté     : {patched}")
    print(f"Doc renommé      : {renamed}")
    print(f"Erreurs          : {errors}")
    if args.dry_run:
        print("\n⚠️  DRY-RUN — aucune modification appliquée.")
    else:
        print("\n✅ Migration terminée.")


if __name__ == "__main__":
    main()
