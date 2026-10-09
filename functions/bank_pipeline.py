"""Reconcile persisted evidence and update the canonical transaction once."""
from datetime import datetime, timezone
from bank_reconciliation import reconcile, confirmation_status
from bank_observations import normalize_linxo, digest
from bank_balance_pipeline import update_balances


def run_reconciliation(store, now=None):
    from bank_lock import banking_write_lock
    with banking_write_lock(store):
        return reconcile_unlocked(store, now)


def reconcile_unlocked(store, now=None):
    now = now or datetime.now(timezone.utc)
    observations = store.all("bank_observations")
    from bank_linxo_identity import attach_legacy_rows
    attach_legacy_rows(store, observations)
    enabled = enabled_accounts(store)
    managed = enabled | historical_accounts(observations)
    observations = [o for o in observations if o.get("compte") in managed and not o.get("supersededBy")]
    eb = [o for o in observations if o["source"] == "enable_banking"]
    lx = [o for o in observations if o["source"] == "gmail"]
    unlinked_eb = [o for o in eb if not o.get("linxoObservationId") and o["bankStatus"] != "cancelled"]
    unlinked_lx = [o for o in lx if not o.get("enableObservationId")]
    result = reconcile(unlinked_eb, unlinked_lx)
    by_id = {o["id"]: o for o in observations}
    for aid, bid in result["matches"]:
        a, b = by_id[aid], by_id[bid]
        # Never silently merge two existing canonical rows with user edits.
        if a.get("canonicalId") and b.get("canonicalId") and a["canonicalId"] != b["canonicalId"]:
            result["suggestions"].append({"enableObservationId": aid, "linxoObservationId": bid})
            continue
        a["linxoObservationId"], b["enableObservationId"] = bid, aid
        store.put("bank_observations", aid, {"linxoObservationId": bid})
        store.put("bank_observations", bid, {"enableObservationId": aid})
    suggestions = result["suggestions"]
    suggestions += [{'enableObservationId': o['id'], 'linxoObservationId': predecessor, 'kind': 'transition'}
                    for o in eb for predecessor in o.get('transitionCandidates', []) if predecessor in by_id]
    deferred = {s["enableObservationId"] for s in suggestions
                if by_id[s['linxoObservationId']].get('canonicalId')}
    deferred_lx = {s["linxoObservationId"] for s in suggestions}
    imported = 0
    for a in eb:
        b = by_id.get(a.get("linxoObservationId"))
        canonical = a.get("canonicalId") or (b or {}).get("canonicalId") or a["id"]
        if a['compte'] not in enabled:
            if b:
                imported += int(store.publish(b, canonical, 'matched'))
                store.put('bank_observations', a['id'], {'canonicalId': canonical})
            continue
        if a["id"] in deferred and not a.get("canonicalId"):
            continue
        imported += int(store.publish(a, canonical, confirmation_status(a, now), b))
    for b in lx:
        if b.get("enableObservationId") or b["id"] in deferred_lx:
            continue
        # Existing Linxo rows remain intact; pending-transfer reconciliation handles re-notification.
        imported += int(store.publish(b, b.get('canonicalId') or b["id"], "not_applicable"))
    suggestions = [{**s, "compte": by_id[s["enableObservationId"]]["compte"],
                    "montant": by_id[s["enableObservationId"]]["montant"],
                    "enableLabel": by_id[s["enableObservationId"]]["libelle"],
                    "linxoLabel": by_id[s["linxoObservationId"]]["libelle"],
                    **observation_details(by_id[s['enableObservationId']], by_id[s['linxoObservationId']])} for s in suggestions]
    for suggestion in suggestions:
        a, b = by_id[suggestion['enableObservationId']], by_id[suggestion['linxoObservationId']]
        if a.get('canonicalId') and b.get('canonicalId') and a['canonicalId'] != b['canonicalId']:
            suggestion['canonicalRows'] = [{key: row.get(key) for key in ('id', 'date', 'compte', 'montant', 'libelle', 'categorie', 'commentaire', 'pointe', 'moisAffectation')}
                                           for row in [store.get('transactions', a['canonicalId']), store.get('transactions', b['canonicalId'])] if row]
    report = {"suggestions": suggestions, "checkedAt": now,
              "matches": [{"enableObservationId": o["id"], "linxoObservationId": o["linxoObservationId"],
                           "compte": o["compte"], "enableLabel": o["libelle"],
                           **observation_details(o, by_id.get(o['linxoObservationId']))} for o in eb if o.get("linxoObservationId")],
              'waiting': [{'id': o['id'], 'compte': o['compte'], 'libelle': o['libelle'],
                           'montant': o['montant'], 'bankStatus': o['bankStatus'], **observation_details(o)}
                          for o in eb if o['compte'] in enabled and not o.get('linxoObservationId') and o['bankStatus'] != 'cancelled'],
              "missing": [{"id": o["id"], "compte": o["compte"], "libelle": o["libelle"],
                           "firstBookedAt": o.get("firstBookedAt")} for o in eb
                          if o['compte'] in enabled and confirmation_status(o, now) == "overdue" and o["bankStatus"] != "cancelled"]}
    store.put("bank_reports", "reconciliation", report)
    return imported


def observation_details(enable, linxo=None):
    return {'enableDate': enable['date'], 'enableReceivedAt': enable['receivedAt'],
            'linxoDate': (linxo or {}).get('date'), 'linxoReceivedAt': (linxo or {}).get('receivedAt')}


def enabled_accounts(store):
    from bank_config import banking_mode
    if banking_mode(store) != 'active':
        return set()
    return {a["compte"] for c in store.all("bank_connections") for a in c.get("accounts", [])
            if a.get("compte") and a.get("enabled")}


def historical_accounts(observations):
    return {o['compte'] for o in observations if o.get('source') == 'enable_banking' and o.get('canonicalId')}


def capture_linxo_balance(store, payload):
    """Email reception is evidence, never an inferred banking date."""
    from bank_balance_store import linxo_balance_observation
    store.balance(linxo_balance_observation(payload))
    return payload["compte"] in enabled_accounts(store)


def route_linxo(store, transactions, result=None):
    from bank_lock import banking_write_lock
    with banking_write_lock(store):
        return route_linxo_unlocked(store, transactions, result)


def route_linxo_unlocked(store, transactions, result=None):
    """Capture ALL observations; only activated accounts use the new writer."""
    observations = normalize_linxo(transactions)
    from bank_linxo_identity import existing_original_rows
    claimed = {o['canonicalId']: o['id'] for o in store.all('bank_observations')
               if o.get('canonicalId') and o['source'] == 'gmail' and not o.get('supersededBy')}
    for o, tx in zip(observations, transactions):
        candidates = [id for id in existing_original_rows(store, o) if claimed.get(id, o['id']) == o['id']]
        if len(candidates) == 1:
            existing_id = candidates[0]
            o["canonicalId"] = existing_id
            claimed[existing_id] = o['id']
    from bank_linxo_identity import link_repeated_notifications
    link_repeated_notifications(store, observations)
    store.observe_unlocked(observations)
    managed = enabled_accounts(store) | historical_accounts(store.all('bank_observations'))
    if managed:
        count = reconcile_unlocked(store)
        if result is not None:
            result['imported'] = count
    return [t for t in transactions if t["compte"] not in managed]
