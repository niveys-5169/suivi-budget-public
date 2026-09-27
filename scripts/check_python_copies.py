"""Vérifie que les modules dupliqués entre src/ et functions/ restent identiques.

Les Cloud Functions ne déploient que functions/ et l'importeur GitHub Actions
n'exécute que src/ : ces modules y sont donc copiés. Une correction appliquée
d'un seul côté ferait diverger silencieusement la prod et l'import quotidien.
firebase_db.py est exclu : les deux versions ont divergé volontairement.
"""

import filecmp
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHARED = [
    "ai_categorizer.py",
    "ai_lexical.py",
    "ai_rag.py",
    "balance_coherence.py",
    "dedup.py",
    "gmail_client.py",
    "transaction_parser.py",
]


def main() -> int:
    divergent = [
        name
        for name in SHARED
        if not filecmp.cmp(ROOT / "src" / name, ROOT / "functions" / name, shallow=False)
    ]
    if divergent:
        print("Copies divergentes entre src/ et functions/ :")
        for name in divergent:
            print(f"  - {name}  (diff src/{name} functions/{name})")
        print("Appliquez la même modification des deux côtés.")
        return 1
    print(f"OK : {len(SHARED)} modules identiques entre src/ et functions/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
