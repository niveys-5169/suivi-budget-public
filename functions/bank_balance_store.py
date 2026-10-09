"""Independent original balance histories and latest-per-source selection."""
from bank_observations import digest


def linxo_balance_observation(payload):
    """Preserve email reception without assuming its bank date or balance type."""
    return {"compte": payload["compte"], "solde": float(payload["solde"]), "currency": "EUR",
            "source": "gmail", "balanceType": "unknown", "bankDate": None,
            "receivedAt": payload["emailDate"], "emailDate": payload["emailDate"],
            "messageId": payload.get("msg_id")}


def store_balance(store, value):
    key = digest(value["compte"], value["source"])
    old = store.get("bank_balance_sources", key)
    from bank_reconciliation import instant
    both_dated = old and instant(value.get('bankDate')) and instant(old.get('bankDate'))
    new_time = instant(value['bankDate'] if both_dated else value['receivedAt'])
    old_time = instant(old['bankDate'] if both_dated else old['receivedAt']) if old else None
    if not old_time or new_time >= old_time:
        store.put("bank_balance_sources", key, value)
    store.put("bank_balance_observations", digest(key, value["receivedAt"]), value)
    if value['source'] == 'enable_banking':
        store.put('account_balance_history', digest('eb', key, value['receivedAt']), {
            'account_id': value['compte'], 'balance_value': value['solde'], 'timestamp': value['receivedAt'],
            'event_type': 'imported_enable_banking', 'source': 'enable_banking',
            'balanceType': value.get('balanceType'), 'bankDate': value.get('bankDate'), 'currency': value['currency']})
