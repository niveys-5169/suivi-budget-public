"""Tests de la règle de sélection de src/cleanup_tronity_duplicates.py.

Ce script supprime des documents financiers : sa règle doit être prouvée.
Le mode `doublons` ne garde qu'un exemplaire par session Tronity — jamais
zéro (sinon une recharge légitime disparaît, tombstone à l'appui).
"""
import importlib.util
import os
import sys
from unittest.mock import MagicMock

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(ROOT, "src")

_SRC_MODULES = ("firebase_db", "cleanup_tronity_duplicates")


def _load_cleanup():
    """Charge le script avec la copie src/ de firebase_db, sans polluer sys.modules."""
    saved = {name: sys.modules.get(name) for name in _SRC_MODULES}
    sys.path.insert(0, SRC_DIR)
    for name in _SRC_MODULES:
        sys.modules.pop(name, None)
    try:
        spec = importlib.util.spec_from_file_location(
            "cleanup_tronity_duplicates",
            os.path.join(SRC_DIR, "cleanup_tronity_duplicates.py"),
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


def _doc(doc_id, session_id, compte="Voiture", pointe=False, **extra):
    snap = MagicMock()
    snap.id = doc_id
    data = {
        "source": "tronity",
        "libelle": "Recharge domicile EV",
        "compte": compte,
        "tronity_session_id": session_id,
        "pointe": pointe,
    }
    data.update(extra)
    snap.to_dict.return_value = data
    return snap


def _collecter(cleanup, docs, monkeypatch):
    monkeypatch.setattr(cleanup, "_stream_with_backoff", lambda query, label: iter(docs))
    return cleanup._collecter_doublons_par_session(MagicMock())


def test_garde_lexemplaire_non_suffixe(cleanup, monkeypatch):
    docs = [
        _doc("tronity_voiture_s1", "s1"),
        _doc("tronity_voiture_s1_2", "s1"),
        _doc("tronity_voiture_s1_3", "s1"),
    ]
    assert sorted(_collecter(cleanup, docs, monkeypatch)) == [
        "tronity_voiture_s1_2",
        "tronity_voiture_s1_3",
    ]


def test_garde_lexemplaire_pointe(cleanup, monkeypatch):
    """La recharge pointée porte les corrections de l'utilisateur : on la garde."""
    docs = [
        _doc("tronity_voiture_s1", "s1"),
        _doc("tronity_voiture_s1_7", "s1", pointe=True),
    ]
    assert _collecter(cleanup, docs, monkeypatch) == ["tronity_voiture_s1"]


def test_session_unique_nest_pas_supprimee(cleanup, monkeypatch):
    docs = [_doc("tronity_voiture_s1", "s1"), _doc("tronity_voiture_s2", "s2")]
    assert _collecter(cleanup, docs, monkeypatch) == []


def test_sessions_identiques_sur_deux_comptes_conservees(cleanup, monkeypatch):
    """Deux comptes distincts ne sont jamais confondus."""
    docs = [
        _doc("tronity_voiture_s1", "s1", compte="Voiture"),
        _doc("tronity_edf_s1", "s1", compte="EDF"),
    ]
    assert _collecter(cleanup, docs, monkeypatch) == []


def test_recharge_sans_session_id_est_ignoree(cleanup, monkeypatch):
    """Sans ID de session, le regroupement n'est pas fiable : on ne touche à rien."""
    docs = [_doc("legacy_a", ""), _doc("legacy_b", "")]
    assert _collecter(cleanup, docs, monkeypatch) == []


def test_200_exemplaires_laissent_exactement_un_document(cleanup, monkeypatch):
    """Le cas de l'incident : 200 exemplaires d'une même recharge."""
    docs = [_doc("tronity_voiture_s1", "s1")] + [
        _doc(f"tronity_voiture_s1_{i}", "s1") for i in range(2, 201)
    ]
    to_delete = _collecter(cleanup, docs, monkeypatch)
    assert len(to_delete) == 199
    assert "tronity_voiture_s1" not in to_delete
