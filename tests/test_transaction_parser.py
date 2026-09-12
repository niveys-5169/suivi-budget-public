"""Tests du parser Linxo sur fixtures réelles (anonymisées) et cas synthétiques.

Fixtures réelles dans tests/fixtures/linxo/ :
  - bforbank_notification.html  → solde 1 234,56 €  (montant anonymisé)
  - lcl_notification.html       → solde 2 500,00 €  (montant anonymisé)

Cas synthétiques construits directement dans le test.
"""
import importlib.util
import os
import sys
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "linxo"
SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
FN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "functions"))

CONFIG = {
    "MONTANT_MIN": -50000,
    "MONTANT_MAX": 50000,
    "COMPTES_ACTIFS": {
        "BforBank Compte Courant": "BforBank",
        "LCL Compte Joint": "LCL",
    },
}


def _load_parser(directory: str):
    """Charge transaction_parser depuis le répertoire donné."""
    saved = {k: sys.modules.pop(k, None) for k in list(sys.modules) if k in ("transaction_parser",)}
    sys.path.insert(0, directory)
    try:
        spec = importlib.util.spec_from_file_location(
            "transaction_parser", os.path.join(directory, "transaction_parser.py")
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.path.pop(0)
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v


_parser_src = _load_parser(SRC_DIR)
_parser_fn = _load_parser(FN_DIR)


# ─── Fixtures réelles ────────────────────────────────────────────────────────

def _read_fixture(name):
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


def test_bforbank_solde_parsed():
    html = _read_fixture("bforbank_notification.html")
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["compte"] == "BforBank Compte Courant"
    # Solde anonymisé de la fixture (email du 2026-06-08)
    assert soldes[0]["solde"] == pytest.approx(1234.56)
    assert soldes[0]["status"] == "OK"


def test_lcl_solde_parsed():
    html = _read_fixture("lcl_notification.html")
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["compte"] == "LCL Compte Joint"
    # Solde anonymisé de la fixture (email du 2026-06-08)
    assert soldes[0]["solde"] == pytest.approx(2500.0)
    assert soldes[0]["status"] == "OK"


def test_bforbank_transactions_parsed():
    html = _read_fixture("bforbank_notification.html")
    txs, _ = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(txs) >= 1
    for tx in txs:
        assert tx["compteLinxo"] == "BforBank Compte Courant"
        assert tx["montant"] < 0  # toutes des dépenses
        assert tx["date"] is not None
        assert tx["libelle"]
        assert tx["enAttente"] is False


def test_lcl_pending_operation_imported():
    """La fixture LCL ne contient qu'une « Opération en attente » (NovaTel).

    Elle DOIT être importée : Linxo ne re-notifie pas les cartes et prélèvements
    une fois réalisés, les ignorer les perdait définitivement. Le drapeau
    enAttente permet la réconciliation ultérieure côté dedup."""
    html = _read_fixture("lcl_notification.html")
    txs, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(txs) == 1
    assert txs[0]["libelle"] == "NovaTel"
    assert txs[0]["montant"] == pytest.approx(-6.50)
    assert txs[0]["enAttente"] is True
    assert len(soldes) == 1
    assert soldes[0]["compte"] == "LCL Compte Joint"


def test_src_and_functions_parsers_give_identical_results():
    """Les deux copies du parser doivent rester identiques."""
    for fixture in ("bforbank_notification.html", "lcl_notification.html"):
        html = _read_fixture(fixture)
        txs_src, soldes_src = _parser_src.parse_email_linxo(html, CONFIG)
        txs_fn, soldes_fn = _parser_fn.parse_email_linxo(html, CONFIG)

        assert len(txs_src) == len(txs_fn), f"Divergence nb transactions sur {fixture}"
        assert len(soldes_src) == len(soldes_fn), f"Divergence nb soldes sur {fixture}"

        for s, f in zip(soldes_src, soldes_fn):
            assert s["solde"] == f["solde"], f"Soldes divergent sur {fixture}"
            assert s["status"] == f["status"]


# ─── Cas synthétiques ────────────────────────────────────────────────────────

def _linxo_operation(type_text: str, name: str, montant: str, date: str) -> str:
    """Reproduit un bloc OPERATIONS Linxo (type → libellé → montant → date)."""
    return f"""
<!--OPERATIONS-->
    <!-- Type of the notification -->
    <font>{type_text}</font>
    <!-- Name of the notification -->
    <strong>{name}</strong>
    <strong>{montant}</strong>
    {date}
<!--END OPERATIONS-->
"""


def test_pending_and_realized_both_parsed_with_correct_flag():
    """Deux opérations : une « en attente » et une réalisée.

    Les deux sont extraites, et le drapeau enAttente est apparié à la BONNE
    transaction — le type précède le libellé, il tombe donc dans le segment
    précédent une fois le HTML découpé sur « Name of the notification »."""
    html = f"""
<!-- Account Name -->
<strong>LCL Compte Joint</strong>
{_linxo_operation("Opération en attente", "SFR", "-4,99 €", "08/06/2026")}
{_linxo_operation("Dépenses", "Monoprix", "-15,00 €", "09/06/2026")}
"""
    txs, _ = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(txs) == 2
    assert txs[0]["libelle"] == "SFR"
    assert txs[0]["enAttente"] is True
    assert txs[1]["libelle"] == "Monoprix"
    assert txs[1]["montant"] == pytest.approx(-15.0)
    assert txs[1]["enAttente"] is False


def test_four_consecutive_pending_operations_all_parsed():
    """Non-régression du mail LCL du 27/07/2026 08:56 (« 4 dépenses : 126,35 € »).

    Ses 4 opérations étaient toutes « en attente » et étaient donc toutes
    perdues. Aucune n'a jamais été re-notifiée comme réalisée."""
    html = f"""
<!-- Account Name -->
<strong>LCL Compte Joint</strong>
{_linxo_operation("Opération en attente", "ASSURANCE LCL", "-11,90 €", "27/07/2026")}
{_linxo_operation("Opération en attente", "BASIC FIT FRANCE", "-24,99 €", "27/07/2026")}
{_linxo_operation("Opération en attente", "SFR", "-27,47 €", "27/07/2026")}
{_linxo_operation("Opération en attente", "AMAZON PAYMENTS EUROPE", "-61,99 €", "27/07/2026")}
"""
    txs, _ = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(txs) == 4
    assert all(tx["enAttente"] is True for tx in txs)
    assert sum(tx["montant"] for tx in txs) == pytest.approx(-126.35)



def _minimal_linxo_email(compte_name: str, status_bloc: str) -> str:
    """Construit un email Linxo minimal avec le bloc STATUS donné."""
    return f"""
<!-- Account Name -->
<table>
  <strong>{compte_name}</strong>
</table>
<!--STATUS ACCOUNT
{status_bloc}
-->END STATUS ACCOUNT-->
"""


def test_solde_with_thousand_separator():
    """Solde avec espace insécable comme séparateur de milliers."""
    html = f"""
<!-- Account Name -->
<strong>BforBank Compte Courant</strong>
<!--STATUS ACCOUNT-->
Solde du compte<strong>12 345,67 €</strong>
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["solde"] == pytest.approx(12345.67)


def test_solde_negatif():
    html = """
<!-- Account Name -->
<strong>BforBank Compte Courant</strong>
<!--STATUS ACCOUNT-->
<strong>Solde du compte</strong>
<strong>-150,00 €</strong>
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["solde"] == pytest.approx(-150.0)


def test_solde_masque_not_captured():
    """Un solde masqué (**** €) ne doit pas être extrait."""
    html = """
<!-- Account Name -->
<strong>BforBank Compte Courant</strong>
<!--STATUS ACCOUNT-->
<strong>Solde du compte</strong>
<strong>**** €</strong>
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 0


def test_previsionnel_not_captured():
    """Le solde prévisionnel (après 'Prévisionnel') ne doit pas être extrait."""
    html = """
<!-- Account Name -->
<strong>LCL Compte Joint</strong>
<!--STATUS ACCOUNT-->
<strong>Solde du compte</strong>
<strong>1 000,00 €</strong>
Prévisionnel
<strong>Votre solde dans 30 jours</strong>
<strong>500,00 €</strong>
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["solde"] == pytest.approx(1000.0)


def test_no_status_bloc_no_solde():
    """Sans bloc STATUS ACCOUNT et sans 'Solde bas', aucun solde extrait."""
    html = """
<!-- Account Name -->
<strong>BforBank Compte Courant</strong>
<!-- Name of the notification -->
<strong>Monoprix</strong>
<strong>-15,00 €</strong>
01/01/2024
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 0


def test_empty_html_returns_empty():
    txs, soldes = _parser_src.parse_email_linxo("", CONFIG)
    assert txs == []
    assert soldes == []


def test_compte_inconnu_ignored():
    """Un compte non présent dans CONFIG['COMPTES_ACTIFS'] est ignoré par l'importer,
    mais le parser lui-même l'extrait quand même (le filtrage est côté importer)."""
    html = """
<!-- Account Name -->
<strong>Compte Inconnu XYZ</strong>
<!--STATUS ACCOUNT-->
<strong>Solde du compte</strong>
<strong>999,00 €</strong>
"""
    _, soldes = _parser_src.parse_email_linxo(html, CONFIG)
    assert len(soldes) == 1
    assert soldes[0]["compte"] == "Compte Inconnu XYZ"


def test_extract_solde_function_ok():
    """Test unitaire direct de _extract_solde_from_status_bloc."""
    html = "<strong>Solde du compte</strong><strong>1 234,56 €</strong>"
    montant, status = _parser_src._extract_solde_from_status_bloc(html)
    assert status == "OK"
    assert montant == pytest.approx(1234.56)


def test_extract_solde_function_masked():
    html = "<strong>Solde du compte</strong><strong>**** €</strong>"
    montant, status = _parser_src._extract_solde_from_status_bloc(html)
    assert status == "masked"
    assert montant is None


def test_extract_solde_function_parse_error():
    html = "<p>Aucun solde ici</p>"
    montant, status = _parser_src._extract_solde_from_status_bloc(html)
    assert status == "parse_error"
    assert montant is None
