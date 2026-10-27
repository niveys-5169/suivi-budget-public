"""Règle de sélection de src/cleanup_bank_representation_duplicates.py.

Le script supprime des documents financiers : il ne doit retenir qu'une ligne
Enable Banking non pointée, intacte, dont une jumelle pointée porte déjà la
même opération sous l'autre forme bancaire.
"""
import pytest
from banking_memory import MemoryStore
from test_banking_pipeline import ACCOUNT, NOW, long_form, short_form

import cleanup_bank_representation_duplicates as cleanup
from bank_observations import normalize_enable
from bank_pipeline import run_reconciliation


@pytest.fixture
def store(monkeypatch):
    monkeypatch.setenv('EB_MODE', 'active')
    s = MemoryStore()
    s.put('bank_connections', 'c', {'accounts': [ACCOUNT], 'status': 'active'})
    return s


def publish_unguarded(store, forms):
    """Reproduit l'état d'avant le correctif : les observations sont écrites sans détection de forme."""
    for observation in normalize_enable(forms, ACCOUNT, NOW):
        store.put('bank_observations', observation['id'], {**observation, 'firstSeenAt': NOW})
    run_reconciliation(store, NOW)


def duplicated(store):
    publish_unguarded(store, [long_form()])
    twin = store.all('transactions')[0]
    store.put('transactions', twin['id'], {'pointe': True, 'categorie': 'Sport'})
    publish_unguarded(store, [short_form()])
    duplicate = next(r for r in store.all('transactions') if r['id'] != twin['id'])
    return twin, duplicate


def test_selects_the_unpointed_duplicate_and_keeps_the_pointed_twin(store):
    twin, duplicate = duplicated(store)
    found = cleanup.plan(store)
    assert [e['id'] for e in found['delete']] == [duplicate['id']]
    entry = found['delete'][0]
    assert entry['twinId'] == twin['id'] and entry['twinObservationId'] in twin['bankObservationIds']
    assert found['skipped'] == []


def test_row_without_pointed_twin_is_ignored(store):
    publish_unguarded(store, [long_form()])
    assert cleanup.plan(store) == {'delete': [], 'skipped': []}


@pytest.mark.parametrize('edit', [{'categorie': 'Mon choix'}, {'commentaire': 'note'}, {'moisAffectation': '2026-11'}])
def test_user_edited_duplicate_is_skipped(store, edit):
    _, duplicate = duplicated(store)
    store.put('transactions', duplicate['id'], edit)
    found = cleanup.plan(store)
    assert found['delete'] == [] and [s['id'] for s in found['skipped']] == [duplicate['id']]


def test_category_set_by_the_ai_categorizer_is_not_a_user_edit(store):
    _, duplicate = duplicated(store)
    store.put('transactions', duplicate['id'], {'categorie': 'Sport', 'aiCategorized': True, 'aiMethod': 'prefix'})
    assert [e['id'] for e in cleanup.plan(store)['delete']] == [duplicate['id']]


def test_duplicate_linked_to_linxo_is_skipped(store):
    _, duplicate = duplicated(store)
    store.put('bank_observations', duplicate['id'], {'linxoObservationId': 'lx_x'})
    assert cleanup.plan(store)['delete'] == []


def test_duplicate_approved_by_a_recurrence_is_skipped(store):
    _, duplicate = duplicated(store)
    store.put('recurrences', 'r', {'approvedMonths': {'2026-10': {'txId': duplicate['id']}}})
    found = cleanup.plan(store)
    assert found['delete'] == [] and found['skipped'][0]['reason'] == 'approuvée par une récurrence'


def test_other_merchant_same_amount_is_not_a_duplicate(store):
    publish_unguarded(store, [long_form()])
    store.put('transactions', store.all('transactions')[0]['id'], {'pointe': True})
    publish_unguarded(store, [short_form(remittance_information=['PRLV SEPA AUTRE MARCHAND'])])
    assert cleanup.plan(store) == {'delete': [], 'skipped': []}


def test_apply_deletes_row_writes_tombstone_backup_and_supersedes_observation(store):
    twin, duplicate = duplicated(store)
    entry = cleanup.plan(store)['delete'][0]
    cleanup.apply_plan(store, [entry], NOW)
    assert store.get('transactions', duplicate['id']) is None
    assert store.get('transactions', twin['id'])['pointe'] is True
    assert store.get('deleted_transactions', duplicate['id'])['source'] == 'cleanup_script'
    assert store.get('bank_cleanup_backups', duplicate['id'])['transaction']['id'] == duplicate['id']
    observation = store.get('bank_observations', duplicate['id'])
    assert observation['supersededBy'] == entry['twinObservationId'] and observation['canonicalId'] == twin['id']


def test_deleted_duplicate_is_not_recreated_by_the_next_reconciliation(store):
    twin, _ = duplicated(store)
    cleanup.apply_plan(store, cleanup.plan(store)['delete'], NOW)
    run_reconciliation(store, NOW)
    assert [r['id'] for r in store.all('transactions')] == [twin['id']]
    assert cleanup.plan(store) == {'delete': [], 'skipped': []}
