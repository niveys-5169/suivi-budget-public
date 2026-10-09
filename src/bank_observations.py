"""Stable source identities and normalization; no user-edited fields involved."""
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone

from bank_reconciliation import cents


def digest(*parts):
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


def normalize_enable(items, account, now):
    counts, result = Counter(), []
    for raw in items:
        amount = raw.get("transaction_amount", {})
        if raw.get('credit_debit_indicator') not in ('DBIT', 'CRDT') or not amount.get('currency') or 'amount' not in amount:
            raise ValueError('INVALID_TRANSACTION_AMOUNT')
        sign = -1 if raw['credit_debit_indicator'] == 'DBIT' else 1
        value = sign * abs(cents(amount.get("amount", "0"))) / 100
        remittance = raw.get('remittance_information') or []
        label = (remittance if isinstance(remittance, str) else ' '.join(remittance)) or (raw.get("creditor") or raw.get("debtor") or {}).get("name") or raw.get("entry_reference") or "Opération bancaire"
        day = raw.get("booking_date") or raw.get("transaction_date") or raw.get("value_date")
        if not day:
            raise ValueError("TRANSACTION_DATE_MISSING")
        status = {"BOOK": "booked", "PDNG": "pending", "HOLD": "pending", "CNCL": "cancelled", "RJCT": "cancelled"}.get(raw.get("status"), "pending")
        reference = raw.get("entry_reference")
        key = digest(account["stableId"], reference) if reference else digest(account["stableId"], day, label, value, amount.get("currency"))
        counts[key] += 1
        oid = "eb_" + key + ("_" + str(counts[key]) if counts[key] > 1 and not reference else "")
        result.append({"id": oid, "source": "enable_banking", "compte": account["compte"],
            "currency": amount.get("currency", "EUR"), "date": day, "libelle": label,
            "montant": value, "bankStatus": status, "reference": reference,
            "receivedAt": now, "firstBookedAt": now if status == "booked" else None,
            "stableAccountId": account["stableId"], 'original': raw})
    by_id = {}
    for o in result:
        previous = by_id.get(o['id'])
        if not previous or previous['bankStatus'] != 'booked' or o['bankStatus'] != 'pending':
            by_id[o['id']] = o
    return list(by_id.values())


def normalize_linxo(items, now=None):
    result, counts = [], Counter()
    for tx in items:
        received = tx.get("emailDate") or now or datetime.now(timezone.utc)
        key = digest(tx.get("messageId"), tx["compte"], str(tx["date"])[:10], tx["libelle"], cents(tx["montant"]))
        counts[key] += 1
        result.append({"id": "lx_" + key + "_" + str(counts[key]), "source": "gmail",
            "compte": tx["compte"], "currency": "EUR", "date": str(tx["date"])[:10],
            "libelle": tx["libelle"], "montant": tx["montant"], "receivedAt": received,
            "bankStatus": "pending" if tx.get("enAttente") else "booked", "messageId": tx.get("messageId"),
            'occurrence': counts[key],
            "canonicalId": tx.get("canonicalId"), "categorie": tx.get("categorie", "")})
    return result
