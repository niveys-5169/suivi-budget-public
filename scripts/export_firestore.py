import json
import firebase_admin
from firebase_admin import credentials, firestore

# Charge les credentials
cred = credentials.Certificate("credentials.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Change le nom de la collection ici
col_name = "transactions"  # ← change si tu veux voir autre chose

print(f"\n=== Exporting {col_name} ===\n")
docs = db.collection(col_name).limit(5).stream()

for doc in docs:
    print(json.dumps({"id": doc.id, **doc.to_dict()}, default=str, indent=2))
    print("---")
