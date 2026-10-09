"""Select the displayed balance and persist independent source controls."""
from datetime import datetime, timezone
from bank_observations import digest
from bank_balances import compare_balances, select_balance

def update_balances(store, now=None):
    from bank_pipeline import enabled_accounts
    now = now or datetime.now(timezone.utc)
    sources = store.all("bank_balance_sources")
    connections = store.all("bank_connections")
    observations = store.all("bank_observations")
    active_accounts = enabled_accounts(store)
    for account in {s["compte"] for s in sources}:
        eb = next((s for s in sources if s["compte"] == account and s["source"] == "enable_banking"), None)
        lx = next((s for s in sources if s["compte"] == account and s["source"] == "gmail"), None)
        linked = [c for c in connections if account in active_accounts and any(a.get("compte") == account and a.get("enabled") for a in c.get("accounts", []))]
        if not linked and (store.get("account_balances", account) or {}).get("source") != "enable_banking":
            continue
        available = any(c.get("status") == "active" for c in linked)
        selected = select_balance(eb, lx, bool(linked), available)
        if not selected:
            continue
        review = compare_balances(eb, lx, observations)
        old = store.get("bank_reports", "balance_" + digest(account)) or {}
        unresolved = review["status"] in ("waiting", "discrepancy")
        review.update({"compte": account, "checkedAt": now, 'monitoringEnabled': bool(linked),
                       "firstUnresolvedAt": (old.get("firstUnresolvedAt") or now) if unresolved else None,
                       "enableBalance": (eb or {}).get("solde"), "linxoBalance": (lx or {}).get("solde")})
        store.put("bank_reports", "balance_" + digest(account), review)
        store.put("account_balances", account, {"compte": account, "current_balance": selected["solde"],
            "solde": selected["solde"], "source": selected["source"], "source_timestamp": selected["receivedAt"],
            "lastUpdated": selected["receivedAt"], "balanceType": selected.get("balanceType"),
            "bankDate": selected.get("bankDate"), "emailDate": selected["receivedAt"] if selected["source"] == "gmail" else None,
            "status": "reconciled" if review['status'] == 'concordant' else "pending_review", "crossControl": review,
            "ecart": None, "updatedAt": now})
