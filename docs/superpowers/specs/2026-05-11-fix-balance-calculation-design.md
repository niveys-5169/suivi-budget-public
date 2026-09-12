# Design Doc: Fix Balance Calculation

**Date:** 2026-05-11

**Author:** Cline

## 1. Overview

The account balances are not being updated correctly because the sum of recent transactions (`linxoDelta`) is always zero. This is due to an inefficient implementation in the `calcul_coherence_solde` function in `functions/firebase_db.py`.

The function currently loads all transactions from Firestore into memory and then filters them. This is inefficient and likely causes the cloud function to time out or run out of memory, resulting in an empty list of transactions.

This design proposes to fix this by filtering the transactions directly in the Firestore query.

## 2. Proposed Changes

The `calcul_coherence_solde` function in `functions/firebase_db.py` will be modified to use a direct Firestore query with a `where` clause to filter transactions by account and date.

### 2.1. Current Implementation

```python
def calcul_coherence_solde(compte: str, nouveau_solde: float, email_date: datetime | None = None) -> dict:
    # ...
    old_email_date = latest_balance.get("emailDate")
    if isinstance(old_email_date, datetime):
        old_date_str = old_email_date.strftime("%Y-%m-%d")
    else:
        old_date_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    tx_since = charger_transactions_existantes_pour_dedoublonnage(since_days=0)
    compte_txs = [
        t for t in tx_since
        if t.get("compte") == compte and t.get("date", "") > old_date_str
    ]
    linxo_delta = sum(float(t.get("montant", 0)) for t in compte_txs)
    # ...
```

### 2.2. New Implementation

```python
def calcul_coherence_solde(compte: str, nouveau_solde: float, email_date: datetime | None = None) -> dict:
    # ...
    old_email_date = latest_balance.get("emailDate")
    if isinstance(old_email_date, datetime):
        old_date_str = old_email_date.strftime("%Y-%m-%d")
    else:
        old_date_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    db = _get_db()
    query = db.collection("transactions") \
              .where(filter=FieldFilter("compte", "==", compte)) \
              .where(filter=FieldFilter("date", ">", old_date_str))

    compte_txs = list(query.stream())

    linxo_delta = sum(float(tx.to_dict().get("montant", 0)) for tx in compte_txs)
    # ...
```

## 3. Testing

The existing tests in `tests/test_balance_reconciliation.py` should be updated to cover this change. A specific test case should be added to ensure that `calcul_coherence_solde` correctly calculates `linxoDelta` with a filtered transaction set.

## 4. Rollout Plan

1.  Apply the code change to `functions/firebase_db.py`.
2.  Deploy the cloud function.
3.  Monitor the account balances to ensure they are being updated correctly.
