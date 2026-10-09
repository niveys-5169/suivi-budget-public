"""Authorization lifecycle with transactional, single-use callback claims."""
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from bank_observations import digest
from bank_reconciliation import instant
from enable_banking_client import BankingError


def configured_urls():
    redirect, app = os.environ.get("EB_REDIRECT_URL", ""), os.environ.get("EB_APP_URL", "")
    if any(urlparse(url).scheme != "https" or not urlparse(url).netloc or urlparse(url).query
           or urlparse(url).fragment or urlparse(url).username for url in (redirect, app)):
        raise BankingError("CONFIGURATION_REQUIRED")
    return redirect, app.rstrip("/")


def start_authorization(store, client, owner, bank, connection_id=None):
    redirect, _ = configured_urls()
    selected = next((b for b in client.banks() if b["name"] == bank and b["country"] == "FR"), None)
    if not selected:
        raise BankingError("UNKNOWN_BANK")
    if connection_id:
        connection = store.get("bank_connections", connection_id)
        if not connection or connection.get("ownerUid") != owner or connection.get("bank") != bank:
            raise BankingError("INVALID_CONNECTION")
    now = datetime.now(timezone.utc)
    state = secrets.token_urlsafe(32)
    cid = connection_id or secrets.token_hex(16)
    store.put("eb_pending_auth", digest(state), {"ownerUid": owner, "connectionId": cid, "bank": bank,
        "expiresAt": now + timedelta(minutes=15), "status": "pending"})
    valid = now + timedelta(seconds=min(int(selected["maximum_consent_validity"]), 180 * 86400))
    result = client.start_auth(bank, state, redirect, valid.isoformat(), owner)
    return {"url": result["url"], "connectionId": cid}


def finish_authorization(store, client, state, code):
    now = datetime.now(timezone.utc)
    if not state or len(state) > 200 or not code or len(code) > 4096:
        raise BankingError("INVALID_CALLBACK")
    def claim(previous):
        if previous.get("status") == "completed":
            return None, {**previous, "alreadyCompleted": True}
        expiry = instant(previous.get("expiresAt"))
        if previous.get("status") not in ("pending", "ready") or not expiry or expiry <= now:
            raise BankingError("INVALID_CALLBACK")
        return {"status": "processing"}, previous
    pending = store.atomic("eb_pending_auth", digest(state), claim)
    if pending.get("alreadyCompleted"):
        return pending["connectionId"]
    try:
        session = pending.get('stagedSession') or client.create_session(code)
        store.put('eb_pending_auth', digest(state), {'stagedSession': session})
        from bank_auth_persist import persist_session
        return persist_session(store, pending, session, digest(state), now)
    except Exception as exc:
        # Unknown exchange outcome: never restore pending (would replay the code).
        retry = isinstance(exc, BankingError) and exc.code == 'BANKING_BUSY'
        store.put("eb_pending_auth", digest(state), {"status": "ready" if retry else "failed"})
        raise


def save_account_mapping(store, owner, cid, mappings):
    from bank_lock import banking_write_lock
    from bank_pipeline import update_balances, reconcile_unlocked
    with banking_write_lock(store):
        result = save_mapping_unlocked(store, owner, cid, mappings)
        reconcile_unlocked(store)
        update_balances(store)
        return result


def save_mapping_unlocked(store, owner, cid, mappings):
    connection = store.get("bank_connections", cid)
    if not connection or connection.get("ownerUid") != owner:
        raise BankingError("INVALID_CONNECTION")
    allowed = {s["compte"] for s in store.all("account_balances")}
    private = store.get("eb_sessions", cid)
    if not private:
        raise BankingError("SESSION_DOES_NOT_EXIST")
    seen = set()
    for account in connection["accounts"]:
        mapping = mappings.get(account["stableId"], {})
        target = mapping.get("compte", "")
        if target and (target not in allowed or target in seen or account.get("currency") != "EUR"):
            raise BankingError("INVALID_MAPPING")
        if target:
            seen.add(target)
        account.update({"compte": target, "enabled": bool(target and mapping.get("enabled"))})
    # Reject mapping the same budget account through two active connections.
    other = {a["compte"] for c in store.all("bank_connections") if c["id"] != cid
             for a in c.get("accounts", []) if a.get("enabled")}
    if any(a["enabled"] and a["compte"] in other for a in connection["accounts"]):
        raise BankingError("DUPLICATE_MAPPING")
    by_id = {a["stableId"]: a for a in connection["accounts"]}
    private_accounts = [{**a, **by_id[a["stableId"]]} for a in private["accounts"]]
    store.put("eb_sessions", cid, {"accounts": private_accounts})
    store.put("bank_connections", cid, {"accounts": connection["accounts"]})
    return {"status": "success"}
