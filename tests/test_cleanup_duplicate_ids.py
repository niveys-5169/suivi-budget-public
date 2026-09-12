"""Tests de la règle de suppression de scripts/cleanup_duplicate_ids.py.

Ce script supprime des documents financiers : sa règle doit être prouvée.
Elle ne cible QUE les documents au format préfixé-compte ayant un jumeau au
format hérité de contenu identique.
"""
import importlib.util
import os
import sys
from datetime import datetime, timezone

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(ROOT, "src")

_SRC_MODULES = ("firebase_db", "cleanup_duplicate_ids")


def _load_cleanup():
    """Charge le script avec la copie src/ de firebase_db, sans polluer sys.modules."""
    saved = {name: sys.modules.get(name) for name in _SRC_MODULES}
    sys.path.insert(0, SRC_DIR)
    for name in _SRC_MODULES:
        sys.modules.pop(name, None)
    try:
        spec = importlib.util.spec_from_file_location(
            "cleanup_duplicate_ids", os.path.join(ROOT, "scripts", "cleanup_duplicate_ids.py")
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        if sys.path and sys.path[0] == SRC_DIR:
            sys.path.pop(0)
        for name, mod in saved.items():
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod


_CLEANUP = _load_cleanup()


@pytest.fixture
def cleanup():
    return _CLEANUP


IMPORTED_AT = datetime(2026, 7, 28, 15, 28, tzinfo=timezone.utc)
SINCE = datetime(2026, 7, 28, 15, 25, tzinfo=timezone.utc)


def _doc(compte, date, libelle, montant, **extra):
    d = {
        "compte": compte,
        "date": date,
        "libelle": libelle,
        "montant": montant,
        "importedAt": IMPORTED_AT,
    }
    d.update(extra)
    return d


def _ids(cleanup, compte, date, libelle, montant):
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    return (
        cleanup._legacy_transaction_id(date_obj, libelle, montant),
        cleanup._transaction_id(compte, date_obj, libelle, montant),
    )


def test_doublon_avec_jumeau_herite_est_supprime(cleanup):
    """Le cas de l'incident : doc préfixé + jumeau hérité identique -> supprimé."""
    legacy_id, new_id = _ids(cleanup, "BforBank", "2026-03-15", "Carrefour", -42.0)
    docs = {
        legacy_id: _doc("BforBank", "2026-03-15", "Carrefour", -42.0, pointe=True),
        new_id: _doc("BforBank", "2026-03-15", "Carrefour", -42.0, pointe=False),
    }
    doublons, conserves, reports = cleanup.analyser(docs, SINCE)
    assert doublons == [new_id]
    assert legacy_id not in doublons, "l'original pointé ne doit JAMAIS être supprimé"
    assert reports == {}


def test_transaction_reellement_nouvelle_est_conservee(cleanup):
    """Les transactions récupérées du 27/07 n'ont pas de jumeau -> conservées."""
    _, new_id = _ids(cleanup, "LCL", "2026-07-27", "ASSURANCE LCL", -11.90)
    docs = {new_id: _doc("LCL", "2026-07-27", "ASSURANCE LCL", -11.90)}
    doublons, conserves, _ = cleanup.analyser(docs, SINCE)
    assert doublons == []
    assert conserves == [new_id]


def test_doublon_avec_original_renomme_est_quand_meme_detecte(cleanup):
    """RÉGRESSION (vérifié en production, 101/271 doublons dans ce cas) : le
    jumeau hérité a été renommé par l'utilisateur dans l'app depuis l'import
    d'origine. L'ID hérité, lui, reste calculé sur le libellé D'ORIGINE — celui
    que porte encore le doublon fraîchement reparsé. Le match doit donc se
    faire sur l'ID (+ compte), pas sur une comparaison texte du libellé."""
    legacy_id, new_id = _ids(cleanup, "BforBank", "2026-05-20", "Anthropic", -12.0)
    docs = {
        legacy_id: _doc("BforBank", "2026-05-20", "Anthropic Claude", -12.0, pointe=True),
        new_id: _doc("BforBank", "2026-05-20", "Anthropic", -12.0, pointe=False),
    }
    doublons, conserves, reports = cleanup.analyser(docs, SINCE)
    assert doublons == [new_id]
    assert legacy_id not in doublons
    assert reports == {}, "le libellé renommé du jumeau ne doit pas être écrasé"


def test_jumeau_dun_autre_compte_nest_pas_un_doublon(cleanup):
    """Collision inter-comptes : même date/libellé/montant mais compte différent.
    Ce sont deux vraies transactions -> aucune suppression."""
    legacy_id, new_id = _ids(cleanup, "LCL", "2026-03-15", "Retrait", -20.0)
    docs = {
        legacy_id: _doc("BforBank", "2026-03-15", "Retrait", -20.0),
        new_id: _doc("LCL", "2026-03-15", "Retrait", -20.0),
    }
    doublons, conserves, _ = cleanup.analyser(docs, SINCE)
    assert doublons == []
    assert new_id in conserves


def test_document_au_format_herite_seul_est_ignore(cleanup):
    """Un document hérité sans doublon n'est jamais touché."""
    legacy_id, _ = _ids(cleanup, "BforBank", "2026-01-05", "Loyer", -1200.0)
    docs = {legacy_id: _doc("BforBank", "2026-01-05", "Loyer", -1200.0, pointe=True)}
    doublons, conserves, _ = cleanup.analyser(docs, SINCE)
    assert doublons == []
    assert conserves == []


def test_travail_utilisateur_du_doublon_est_reporte(cleanup):
    """Si l'utilisateur a pointé le DOUBLON depuis l'incident, le pointage est
    reporté sur le jumeau hérité avant suppression."""
    legacy_id, new_id = _ids(cleanup, "BforBank", "2026-03-15", "Carrefour", -42.0)
    docs = {
        legacy_id: _doc("BforBank", "2026-03-15", "Carrefour", -42.0, pointe=False),
        new_id: _doc("BforBank", "2026-03-15", "Carrefour", -42.0,
                     pointe=True, commentaire="vérifié"),
    }
    doublons, _, reports = cleanup.analyser(docs, SINCE)
    assert doublons == [new_id]
    assert reports[legacy_id] == {"pointe": True, "commentaire": "vérifié"}


def test_document_anterieur_a_lincident_est_conserve(cleanup):
    """Garde-fou --since-imported : un doc préfixé importé AVANT l'incident
    n'est pas traité."""
    legacy_id, new_id = _ids(cleanup, "BforBank", "2026-03-15", "Carrefour", -42.0)
    vieux = _doc("BforBank", "2026-03-15", "Carrefour", -42.0)
    vieux["importedAt"] = datetime(2026, 7, 1, tzinfo=timezone.utc)
    docs = {
        legacy_id: _doc("BforBank", "2026-03-15", "Carrefour", -42.0),
        new_id: vieux,
    }
    doublons, conserves, _ = cleanup.analyser(docs, SINCE)
    assert doublons == []
    assert new_id in conserves
