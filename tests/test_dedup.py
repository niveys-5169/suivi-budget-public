"""
Tests unitaires pour src/dedup.py — logique de déduplication partagée.
"""
from datetime import datetime

from dedup import deduplicate, reconcile_pending


def _tx(date, libelle, montant, compte="LCL"):
    return {"date": date, "libelle": libelle, "montant": montant, "compte": compte}


def _stockee(doc_id, date, libelle, montant, compte="LCL", en_attente=False):
    """Transaction déjà en base, telle que renvoyée par le loader de dédup."""
    return {
        "id": doc_id,
        "date": date,
        "libelle": libelle,
        "montant": montant,
        "compte": compte,
        "enAttente": en_attente,
    }


def test_strict_duplicate_same_account():
    """Date + libellé[:40] + montant + compte identiques -> doublon strict."""
    existantes = [_tx("2026-06-01", "Loyer", -1200.0, "LCL")]
    nouvelles = [_tx(datetime(2026, 6, 1), "Loyer", -1200.0, "LCL")]
    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    assert len(a_importer) == 0
    assert len(stricts) == 1
    assert len(probables) == 0


def test_probable_duplicate_same_account_within_3_days():
    """Même compte, même montant, libellé différent, ±3 jours -> doublon probable."""
    existantes = [_tx("2026-06-01", "Loyer", -1200.0, "LCL")]
    nouvelles = [_tx(datetime(2026, 6, 3), "Loyer Studio", -1200.0, "LCL")]
    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    assert len(probables) == 1
    assert len(a_importer) == 0


def test_same_amount_different_account_is_not_duplicate():
    """RÉGRESSION : même montant/date sur DEUX comptes distincts ne doit jamais
    être confondu — sinon une transaction légitime disparaît du dashboard."""
    existantes = [_tx("2026-06-01", "Loyer", -1200.0, "LCL")]
    nouvelles = [_tx(datetime(2026, 6, 3), "Loyer Studio", -1200.0, "BforBank")]
    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    assert len(a_importer) == 1
    assert len(probables) == 0
    assert len(stricts) == 0


def test_same_account_outside_window_is_new():
    """Même compte/montant mais > 3 jours d'écart -> transaction nouvelle."""
    existantes = [_tx("2026-06-01", "Loyer", -1200.0, "LCL")]
    nouvelles = [_tx(datetime(2026, 6, 10), "Loyer", -1200.0, "LCL")]
    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    assert len(a_importer) == 1
    assert len(probables) == 0


def test_strict_match_respects_libelle_max_len():
    """Le strict-match tronque le libellé à 40 car. des deux côtés."""
    long_a = "X" * 50 + "AAA"
    long_b = "X" * 50 + "BBB"  # diffèrent seulement après le 40e caractère
    existantes = [_tx("2026-06-01", long_a, -10.0, "LCL")]
    nouvelles = [_tx(datetime(2026, 6, 1), long_b, -10.0, "LCL")]
    _, stricts, _ = deduplicate(nouvelles, existantes)
    assert len(stricts) == 1


def test_malformed_rows_are_skipped():
    """Lignes existantes/nouvelles malformées ignorées sans planter."""
    existantes = [{"date": "not-a-date", "montant": "abc"}]
    nouvelles = [_tx(datetime(2026, 6, 1), "Café", -3.5, "LCL"), {"montant": None}]
    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    assert len(a_importer) == 1


# ─── reconcile_pending ───────────────────────────────────────────────────────

def test_reconcile_pending_keeps_lonely_pending():
    """RÉGRESSION (mail LCL du 27/07/2026) : une opération « en attente » sans
    contrepartie réalisée doit être conservée. Linxo ne re-notifie pas les
    cartes et prélèvements — les ignorer les perdait définitivement."""
    nouvelles = [
        {**_tx(datetime(2026, 7, 27), "ASSURANCE LCL", -11.90), "enAttente": True},
        {**_tx(datetime(2026, 7, 27), "BASIC FIT FRANCE", -24.99), "enAttente": True},
    ]
    filtrees, obsoletes = reconcile_pending(nouvelles, [])
    assert len(filtrees) == 2
    assert obsoletes == []


def test_reconcile_pending_intra_batch():
    """Un même lot contient l'opération en attente et sa version réalisée :
    seule la réalisée est conservée (vrai libellé, date de valeur)."""
    nouvelles = [
        {**_tx(datetime(2026, 7, 24), "INSTANTANE", -57.47), "enAttente": True},
        {**_tx(datetime(2026, 7, 23), "Banque CCF Pro Elysee", -57.47), "enAttente": False},
    ]
    filtrees, obsoletes = reconcile_pending(nouvelles, [])
    assert [tx["libelle"] for tx in filtrees] == ["Banque CCF Pro Elysee"]
    assert obsoletes == []


def test_reconcile_pending_supersedes_stored_pending():
    """La version réalisée arrive alors que l'opération en attente est déjà en
    base : elle est importée et l'ancien document est marqué pour suppression."""
    existantes = [_stockee("2026-07-24_instantane_n5747", "2026-07-24", "INSTANTANE", -57.47, en_attente=True)]
    nouvelles = [{**_tx(datetime(2026, 7, 23), "Banque CCF Pro Elysee", -57.47), "enAttente": False}]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert len(filtrees) == 1
    assert obsoletes == ["2026-07-24_instantane_n5747"]


def test_reconcile_pending_ignores_realized_stored_transaction():
    """Un document déjà réalisé en base n'est jamais supprimé, même si une
    nouvelle transaction du même montant tombe dans la fenêtre."""
    existantes = [_stockee("doc-realisee", "2026-07-24", "Intermarché", -57.47, en_attente=False)]
    nouvelles = [{**_tx(datetime(2026, 7, 23), "Carrefour", -57.47), "enAttente": False}]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert len(filtrees) == 1
    assert obsoletes == []


def test_reconcile_pending_ignores_other_account():
    """Même montant, même date, compte différent -> aucune réconciliation."""
    existantes = [_stockee("doc-lcl", "2026-07-24", "INSTANTANE", -57.47, "LCL", en_attente=True)]
    nouvelles = [{**_tx(datetime(2026, 7, 24), "Virement", -57.47, "BforBank"), "enAttente": False}]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert len(filtrees) == 1
    assert obsoletes == []


def test_reconcile_pending_outside_window_is_kept():
    """Au-delà de ±3 jours, l'opération en attente stockée n'est pas remplacée."""
    existantes = [_stockee("doc-pending", "2026-07-20", "INSTANTANE", -57.47, en_attente=True)]
    nouvelles = [{**_tx(datetime(2026, 7, 27), "Banque CCF Pro Elysee", -57.47), "enAttente": False}]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert len(filtrees) == 1
    assert obsoletes == []


def test_reconcile_pending_consumes_each_stored_doc_once():
    """Deux transactions réalisées face à une seule opération en attente stockée :
    un seul document est supprimé — deux prélèvements du même montant ne
    s'annulent pas mutuellement."""
    existantes = [_stockee("doc-pending", "2026-07-24", "INSTANTANE", -20.0, en_attente=True)]
    nouvelles = [
        {**_tx(datetime(2026, 7, 24), "Boulangerie", -20.0), "enAttente": False},
        {**_tx(datetime(2026, 7, 25), "Pharmacie", -20.0), "enAttente": False},
    ]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert len(filtrees) == 2
    assert obsoletes == ["doc-pending"]


def test_reconcile_pending_matches_closest_date():
    """Face à plusieurs opérations en attente candidates, la plus proche en
    date est celle qui est remplacée."""
    existantes = [
        _stockee("doc-loin", "2026-07-21", "INSTANTANE", -30.0, en_attente=True),
        _stockee("doc-proche", "2026-07-23", "INSTANTANE", -30.0, en_attente=True),
    ]
    nouvelles = [{**_tx(datetime(2026, 7, 24), "Vrai Libellé", -30.0), "enAttente": False}]
    _, obsoletes = reconcile_pending(nouvelles, existantes)
    assert obsoletes == ["doc-proche"]


def test_reconcile_pending_without_flags_is_noop():
    """Sources sans notion d'attente (Enable Banking, Tronity) : rien ne change."""
    existantes = [_stockee("doc", "2026-07-24", "Loyer", -1200.0)]
    nouvelles = [_tx(datetime(2026, 7, 24), "Loyer", -1200.0)]
    filtrees, obsoletes = reconcile_pending(nouvelles, existantes)
    assert filtrees == nouvelles
    assert obsoletes == []
