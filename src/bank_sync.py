"""Daily/manual synchronization, sharing a Firestore lease and execution result."""
import uuid
import os
from datetime import datetime, timedelta, timezone
from bank_config import banking_mode
from bank_reconciliation import instant
from bank_observations import normalize_enable
from bank_balances import choose_enable_balance
from bank_pipeline import run_reconciliation, update_balances
from enable_banking_client import BankingError, AUTH_ERRORS


def import_account(store, client, account, uid, now):
    # Pagination must finish before publishing any observation from this account.
    rows = client.transactions(uid, (now - timedelta(days=30)).date().isoformat())
    observations = normalize_enable(rows, account, now)
    balances = client.balances(uid)
    if any(o['currency'] != 'EUR' for o in observations) or any(b.get('balance_amount', {}).get('currency') != 'EUR' for b in balances):
        raise BankingError('UNSUPPORTED_CURRENCY')
    store.observe(observations)
    selected = choose_enable_balance(balances)
    if selected:
        store.balance({"compte": account["compte"], "source": "enable_banking",
            "solde": float(selected["balance_amount"]["amount"]), "currency": selected["balance_amount"]["currency"],
            "balanceType": selected["balance_type"], "bankDate": selected.get("last_change_date_time") or selected.get("reference_date"),
            "receivedAt": now})


def import_connection(store, connection, client_factory, now):
    cid = connection["id"]
    store.put("bank_connections", cid, {"lastAttemptAt": now, 'mode': banking_mode(store)})
    errors, successes = [], []
    try:
        expiry = instant(connection.get("validUntil"))
        if not expiry or expiry <= now:
            raise BankingError("EXPIRED_SESSION")
        client = client_factory()
        private = store.get("eb_sessions", cid)
        if not private:
            raise BankingError("SESSION_DOES_NOT_EXIST")
        session = client.session(private["sessionId"])
        if session.get("status") != "AUTHORIZED":
            raise BankingError({"REVOKED": "REVOKED_SESSION", "CLOSED": "CLOSED_SESSION",
                                "EXPIRED": "EXPIRED_SESSION"}.get(session.get("status"), "SESSION_NOT_AUTHORIZED"))
        uids = {a["stableId"]: a["accountUid"] for a in private["accounts"]}
        for account in connection.get("accounts", []):
            if not account.get("compte"):
                continue
            try:
                import_account(store, client, account, uids[account["stableId"]], now)
                successes.append(account["stableId"])
            except Exception as exc:
                errors.append(exc)
    except Exception as exc:
        errors.append(exc)
    if errors:
        error = next((e for e in errors if isinstance(e, BankingError) and e.code in AUTH_ERRORS), errors[0])
        code = error.code if isinstance(error, BankingError) else "IMPORT_ERROR"
        status = "reconnect" if code in AUTH_ERRORS else "temporary_error" if isinstance(error, BankingError) and error.temporary else "technical_error"
        old = store.get("bank_connections", cid) or {}
        store.put("bank_connections", cid, {"status": status, "errorCode": code,
            "errorSince": old.get("errorSince") if old.get("errorCode") == code else now,
            "successfulAccounts": successes})
        return code, bool(successes)
    store.put("bank_connections", cid, {"status": "active", "errorCode": None, "errorSince": None, "lastSuccessAt": now,
                                      "successfulAccounts": successes})
    return "success", True


def sync_banking(store, client_factory, linxo_import=None, execution_id=None):
    now, rid = datetime.now(timezone.utc), execution_id or uuid.uuid4().hex
    def acquire(old):
        if instant(old.get("expiresAt")) and instant(old["expiresAt"]) > now:
            return None, old["runId"]
        return {"runId": rid, "expiresAt": now + timedelta(minutes=10)}, rid
    active = store.atomic("bank_locks", "sync", acquire)
    if active != rid:
        return {"id": active, "status": "running"}
    result = {"id": rid, "status": "running", "startedAt": now, "sources": {}, "imported": 0, "mode": banking_mode(store)}
    store.put("bank_sync_runs", rid, result)
    if os.environ.get('EB_MODE'):
        store.put('bank_runtime', 'config', {'mode': banking_mode(store), 'updatedAt': now})
    partial_account = False
    try:
        for connection in store.all('bank_connections'):
            store.put('bank_connections', connection['id'], {'mode': banking_mode(store)})
            if banking_mode(store) != "disabled":
                if not any(a.get("compte") for a in connection.get("accounts", [])):
                    continue
                status, partial = import_connection(store, connection, client_factory, now)
                result["sources"][connection["id"]] = status
                partial_account |= partial and status != "success"
        if linxo_import:
            try:
                linxo = linxo_import()
                result["imported"] += (linxo or {}).get("transactionsImported", 0)
                result["sources"]["linxo"] = "success"
            except Exception:
                result["sources"]["linxo"] = "IMPORT_ERROR"
        result["imported"] += run_reconciliation(store, now)
        update_balances(store, now)
        success = sum(s == "success" for s in result["sources"].values())
        result["status"] = "success" if success == len(result["sources"]) else "partial" if success or partial_account else "error"
    except Exception:
        result.update({"status": "error", "errorCode": "RECONCILIATION_ERROR"})
    finally:
        result["finishedAt"] = datetime.now(timezone.utc)
        store.put("bank_sync_runs", rid, result)
        store.atomic("bank_locks", "sync", lambda old: ({"expiresAt": now}, None) if old.get("runId") == rid else (None, None))
    return result
