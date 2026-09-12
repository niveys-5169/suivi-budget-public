"""
Garde-fou anti-dérive des modules backend dupliqués entre src/ et functions/.

Contexte : plusieurs modules existent en double copie — une dans src/ (exécutée
par les GitHub Actions d'import : importer.py, tronity_importer.py)
et une dans functions/ (déployée en Cloud Functions Python,
qui embarque le dossier functions/ tel quel). Ces copies sont maintenues à la
main ; rien n'empêchait jusqu'ici qu'un correctif appliqué d'un seul côté fasse
diverger silencieusement les deux environnements.

Ce test échoue dès qu'une des copies « censées identiques » diverge, forçant à
répercuter tout changement des deux côtés (ou à retirer le module de la liste
si la divergence devient volontaire).

`firebase_db.py` est VOLONTAIREMENT exclu : les deux copies diffèrent par
conception (init Firebase depuis FIREBASE_CREDENTIALS côté src/ vs client fourni
par le runtime côté functions/, et jeux de fonctions distincts). Voir l'en-tête
des deux fichiers `firebase_db.py`.
"""
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "src"
FUNCTIONS_DIR = REPO_ROOT / "functions"

# Modules dont les copies src/ et functions/ doivent rester byte-identiques.
IDENTICAL_MODULES = [
    "ai_categorizer.py",
    "dedup.py",
    "ai_lexical.py",
    "ai_rag.py",
    "balance_coherence.py",
    "transaction_parser.py",
    "gmail_client.py",
]


@pytest.mark.parametrize("module", IDENTICAL_MODULES)
def test_shared_module_is_byte_identical(module):
    src_file = SRC_DIR / module
    fn_file = FUNCTIONS_DIR / module
    assert src_file.exists(), f"src/{module} manquant"
    assert fn_file.exists(), f"functions/{module} manquant"

    src_bytes = src_file.read_bytes()
    fn_bytes = fn_file.read_bytes()
    assert src_bytes == fn_bytes, (
        f"src/{module} et functions/{module} ont divergé. "
        f"Répercute le changement des deux côtés, ou retire {module} de "
        f"IDENTICAL_MODULES si la divergence est volontaire."
    )


def test_firebase_db_divergence_is_intentional():
    """firebase_db.py diverge par conception — ce test documente et fige ce choix.

    Si un jour les deux copies redeviennent identiques, c'est probablement une
    régression (perte des fonctions uniques à src/) : ce test le signalera.
    """
    src_file = SRC_DIR / "firebase_db.py"
    fn_file = FUNCTIONS_DIR / "firebase_db.py"
    assert src_file.exists() and fn_file.exists()
    assert src_file.read_bytes() != fn_file.read_bytes(), (
        "src/firebase_db.py et functions/firebase_db.py sont devenus identiques. "
        "Ils DOIVENT différer (init Firebase et jeux de fonctions distincts) — "
        "vérifie qu'aucune copie n'a écrasé l'autre."
    )
