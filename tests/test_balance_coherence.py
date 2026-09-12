"""Tests unitaires purs pour src/balance_coherence.py.

Zéro dépendance Firestore — toutes les fonctions sont testées en isolation.
"""
import sys
import os
from datetime import datetime, timezone, timedelta

import pytest

# Charger balance_coherence depuis src/ sans polluer sys.modules
SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, SRC_DIR)
from balance_coherence import (
    ensure_utc,
    filter_window_transactions,
    compute_coherence,
    resolve_status,
)
sys.path.pop(0)


# ─── ensure_utc ─────────────────────────────────────────────────────────────

def test_ensure_utc_naive_becomes_aware():
    naive = datetime(2024, 1, 1, 12, 0, 0)
    result = ensure_utc(naive)
    assert result.tzinfo is not None
    assert result == datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def test_ensure_utc_aware_stays_utc():
    aware = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    assert ensure_utc(aware) == aware


def test_ensure_utc_non_datetime_returns_none():
    assert ensure_utc(None) is None
    assert ensure_utc("2024-01-01") is None
    assert ensure_utc(1234) is None


def test_ensure_utc_aware_non_utc_is_normalized():
    import zoneinfo
    paris = zoneinfo.ZoneInfo("Europe/Paris")
    aware_paris = datetime(2024, 6, 1, 14, 0, 0, tzinfo=paris)
    result = ensure_utc(aware_paris)
    assert result.tzinfo == timezone.utc
    assert result.hour == 12  # UTC+2 en été → 14h Paris = 12h UTC


# ─── filter_window_transactions ──────────────────────────────────────────────

T0 = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)   # anchor (ancien solde)
T1 = datetime(2024, 1, 2, 10, 0, 0, tzinfo=timezone.utc)   # dans la fenêtre
T2 = datetime(2024, 1, 3, 10, 0, 0, tzinfo=timezone.utc)   # dans la fenêtre
T3 = datetime(2024, 1, 4, 10, 0, 0, tzinfo=timezone.utc)   # upper (mail courant)
T4 = datetime(2024, 1, 5, 10, 0, 0, tzinfo=timezone.utc)   # après upper

def _tx(compte, montant, email_date):
    return {"compte": compte, "montant": montant, "emailDate": email_date, "date": "2024-01-02"}


def test_filter_basic_window():
    txs = [
        _tx("BforBank", -10.0, T1),
        _tx("BforBank", -20.0, T2),
    ]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert len(result) == 2


def test_filter_excludes_old_boundary():
    # T0 exact → exclusif
    txs = [_tx("BforBank", -10.0, T0)]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert result == []


def test_filter_includes_upper_boundary():
    # T3 exact → inclusif
    txs = [_tx("BforBank", -10.0, T3)]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert len(result) == 1


def test_filter_excludes_after_upper():
    txs = [_tx("BforBank", -10.0, T4)]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert result == []


def test_filter_excludes_other_account():
    txs = [_tx("LCL", -10.0, T1)]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert result == []


def test_filter_excludes_tx_without_email_date():
    tx = {"compte": "BforBank", "montant": -10.0, "date": "2024-01-02"}
    result = filter_window_transactions([tx], "BforBank", T0, T3)
    assert result == []


def test_filter_normalizes_naive_datetime():
    naive_t1 = datetime(2024, 1, 2, 10, 0, 0)  # naïf
    txs = [_tx("BforBank", -10.0, naive_t1)]
    result = filter_window_transactions(txs, "BforBank", T0, T3)
    assert len(result) == 1


def test_filter_no_upper_includes_all_after_old():
    txs = [_tx("BforBank", -10.0, T1), _tx("BforBank", -20.0, T4)]
    result = filter_window_transactions(txs, "BforBank", T0, None)
    assert len(result) == 2


def test_filter_no_old_includes_all_before_upper():
    txs = [_tx("BforBank", -10.0, T1), _tx("BforBank", -20.0, T4)]
    result = filter_window_transactions(txs, "BforBank", None, T3)
    assert len(result) == 1  # T4 > T3 → exclu


def test_filter_two_mails_same_day():
    """Deux mails du même compte le même jour : upper_email_date borne chaque mail."""
    T_mail1 = datetime(2024, 1, 3, 8, 0, 0, tzinfo=timezone.utc)
    T_mail2 = datetime(2024, 1, 3, 16, 0, 0, tzinfo=timezone.utc)
    tx_mail1 = _tx("BforBank", -10.0, T_mail1)
    tx_mail2 = _tx("BforBank", -20.0, T_mail2)

    # Calcul pour mail1 : ne doit pas voir tx_mail2
    result1 = filter_window_transactions([tx_mail1, tx_mail2], "BforBank", T0, T_mail1)
    assert len(result1) == 1
    assert result1[0]["montant"] == -10.0

    # Calcul pour mail2 : voit les deux
    result2 = filter_window_transactions([tx_mail1, tx_mail2], "BforBank", T0, T_mail2)
    assert len(result2) == 2


# ─── compute_coherence ───────────────────────────────────────────────────────

def test_compute_coherence_no_previous():
    result = compute_coherence(None, 1000.0, [])
    assert result == {"previousSolde": None, "linxoDelta": None, "computedSolde": None, "ecart": None}


def test_compute_coherence_reconciled():
    txs = [{"montant": -100.0}, {"montant": -50.0}]
    result = compute_coherence(1000.0, 850.0, txs)
    assert result["previousSolde"] == 1000.0
    assert result["linxoDelta"] == -150.0
    assert result["computedSolde"] == 850.0
    assert result["ecart"] == 0.0


def test_compute_coherence_with_gap():
    txs = [{"montant": -100.0}]
    result = compute_coherence(1000.0, 800.0, txs)
    assert result["ecart"] == -100.0  # attendu 900, reçu 800 → écart = -100


def test_compute_coherence_empty_window():
    result = compute_coherence(1000.0, 1000.0, [])
    assert result["linxoDelta"] == 0.0
    assert result["ecart"] == 0.0


def test_compute_coherence_ecart_rounded():
    txs = [{"montant": -33.333}]
    result = compute_coherence(100.0, 66.67, txs)
    assert result["ecart"] == round(66.67 - (100.0 - 33.333), 2)


def test_compute_coherence_no_float_accumulation_error():
    """Régression : la sommation en centimes évite la dérive de l'addition
    flottante répétée. `sum([0.1] * 10)` vaut 0.9999999999999999 en float pur
    (pas 1.0) — sous tolérance zéro, un tel résidu aurait pu faire basculer un
    solde réellement réconcilié en pending_review. En centimes, linxoDelta et
    ecart doivent être exacts."""
    txs = [{"montant": 0.1} for _ in range(10)]
    assert sum(t["montant"] for t in txs) != 1.0  # démontre l'imprécision flottante brute

    result = compute_coherence(1000.0, 1001.0, txs)
    assert result["linxoDelta"] == 1.0
    assert result["computedSolde"] == 1001.0
    assert result["ecart"] == 0.0


# ─── resolve_status ──────────────────────────────────────────────────────────

def test_resolve_status_none_ecart_is_reconciled():
    assert resolve_status(None, 0.0) == "reconciled"
    assert resolve_status(None, 5.0) == "reconciled"


def test_resolve_status_zero_ecart_is_reconciled():
    assert resolve_status(0.0, 0.0) == "reconciled"


def test_resolve_status_small_ecart_within_tolerance():
    assert resolve_status(0.01, 0.05) == "reconciled"
    assert resolve_status(-0.04, 0.05) == "reconciled"


def test_resolve_status_ecart_beyond_tolerance():
    assert resolve_status(0.06, 0.05) == "pending_review"
    assert resolve_status(-10.0, 0.0) == "pending_review"
    assert resolve_status(50.0, 0.0) == "pending_review"


def test_resolve_status_strict_tolerance():
    # Tolérance = 0 : tout écart non nul → pending
    assert resolve_status(0.01, 0.0) == "pending_review"
    assert resolve_status(-0.01, 0.0) == "pending_review"


# ─── Scénarios de bout en bout ───────────────────────────────────────────────

def test_scenario_missed_notification_then_auto_reconciles():
    """Un mouvement non notifié génère pending, le mail suivant repart propre."""
    # Setup : solde initial 1000 €, emailDate T0
    previous = 1000.0
    # Mail 1 : solde Linxo 900 €, mais une tx de -50 seulement (une de -50 manque)
    tx1 = _tx("BforBank", -50.0, T1)
    window1 = filter_window_transactions([tx1], "BforBank", T0, T2)
    coherence1 = compute_coherence(previous, 900.0, window1)
    status1 = resolve_status(coherence1["ecart"], 0.0)
    assert status1 == "pending_review"  # attendu 950, reçu 900 → -50 de gap

    # Mail 2 : solde Linxo 800 €, tx de -100 dans la fenêtre (T2→T3)
    # L'anchor pour mail2 est maintenant 900 € (le solde du mail1, même si pending)
    tx2 = _tx("BforBank", -100.0, T2)
    window2 = filter_window_transactions([tx2], "BforBank", T1, T3)
    coherence2 = compute_coherence(900.0, 800.0, window2)
    status2 = resolve_status(coherence2["ecart"], 0.0)
    assert status2 == "reconciled"  # attendu 800, reçu 800 → OK


def test_scenario_manual_reconciliation_reanchors():
    """Résolution manuelle : emailDate = NOW → tx antérieures exclues du prochain calcul."""
    manual_resolve_date = datetime(2024, 1, 3, 0, 0, 0, tzinfo=timezone.utc)

    # Tx qui existait avant la résolution manuelle
    tx_before = _tx("BforBank", -100.0, T1)
    # Tx postérieure à la résolution
    tx_after = _tx("BforBank", -50.0, T4)

    # Prochain calcul : fenêtre depuis manual_resolve_date
    window = filter_window_transactions(
        [tx_before, tx_after], "BforBank", manual_resolve_date, T4
    )
    # Seule tx_after doit être incluse
    assert len(window) == 1
    assert window[0]["montant"] == -50.0
