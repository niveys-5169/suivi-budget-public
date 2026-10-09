import pytest
from banking_memory import MemoryStore
from enable_banking_client import BankingError


def test_explicit_survivor_keeps_user_fields_retargets_recurrence_and_observations():
    s = MemoryStore()
    s.put('transactions', 'kept', {'id': 'kept', 'categorie': 'Choisie', 'commentaire': 'Important', 'pointe': True})
    s.put('transactions', 'old', {'id': 'old', 'categorie': 'Autre'})
    s.put('recurrences', 'r', {'approvedMonths': {'2026-10': {'txId': 'old', 'entries': [{'txId': 'old', 'amount': -42, 'date': '2026-10-01'}]}}})
    s.put('bank_observations', 'o', {'canonicalId': 'old'})
    s.merge_rows('kept', 'old')
    assert s.get('transactions', 'old') is None
    assert s.get('transactions', 'kept')['commentaire'] == 'Important'
    assert s.get('bank_observations', 'o')['canonicalId'] == 'kept'
    assert s.get('recurrences', 'r')['approvedMonths']['2026-10']['txId'] == 'kept'
    assert s.get('bank_merge_history', 'old')['discardedFields']['categorie'] == 'Autre'


def test_conflicting_recurrence_links_require_explicit_resolution_before_merge():
    s = MemoryStore()
    s.put('transactions', 'a', {'id': 'a'}); s.put('transactions', 'b', {'id': 'b'})
    s.put('recurrences', 'r1', {'approvedMonths': {'m': {'txId': 'a'}}})
    s.put('recurrences', 'r2', {'approvedMonths': {'m': {'txId': 'b'}}})
    with pytest.raises(BankingError, match='RECURRENCE_LINK_CONFLICT'): s.merge_rows('a', 'b')
    assert s.get('transactions', 'a') and s.get('transactions', 'b')
