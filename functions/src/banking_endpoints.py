"""Thin callable adapters. Business code is shared with the CLI importer."""
from firebase_functions import https_fn
from bank_store import BankStore
from bank_auth import start_authorization, save_account_mapping
from bank_pipeline import run_reconciliation, update_balances
from enable_banking_client import EnableBankingClient, BankingError
from src.auth import require_owner


def store():
    from firebase_db import _get_db
    return BankStore(_get_db())


def call(req, action):
    require_owner(req)
    try:
        return action(store(), req.data or {})
    except (BankingError, ValueError, KeyError) as exc:
        code = exc.code if isinstance(exc, BankingError) else "INVALID_REQUEST"
        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.FAILED_PRECONDITION, code) from None


def list_banks(req):
    from bank_config import banking_mode
    return call(req, lambda s, d: {"mode": banking_mode(), "banks": [{"name": b["name"], "country": b["country"]} for b in EnableBankingClient().banks()]})


def auth_start(req):
    return call(req, lambda s, d: start_authorization(s, EnableBankingClient(), req.auth.uid, d["bank"], d.get("connectionId")))


def mapping(req):
    return call(req, lambda s, d: save_account_mapping(s, req.auth.uid, d["connectionId"], d["accounts"]))


def reconcile_action(req):
    from bank_lock import banking_write_lock
    from bank_pipeline import reconcile_unlocked
    def action(s, data):
        with banking_write_lock(s):
            return perform(s, data)
    def perform(s, data):
        a, b = s.get("bank_observations", data["enableObservationId"]), s.get("bank_observations", data["linxoObservationId"])
        transition = data.get('kind') == 'transition'
        if not a or not b or a["source"] != "enable_banking" or b["source"] != ('enable_banking' if transition else 'gmail'):
            raise ValueError("INVALID_OBSERVATIONS")
        from bank_reconciliation import compatible
        if not compatible(a, b):
            raise ValueError("INCOMPATIBLE_OBSERVATIONS")
        kind = data["action"]
        if kind == "distinct":
            s.put("bank_observations", a["id"], {"distinctFrom": list(set(a.get("distinctFrom", []) + [b["id"]]))})
            if transition:
                s.put('bank_observations', a['id'], {'transitionCandidates': [oid for oid in a.get('transitionCandidates', []) if oid != b['id']]})
        elif kind == "unlink":
            if a.get("linxoObservationId") != b["id"]:
                raise ValueError("NOT_LINKED")
            s.put("bank_observations", a["id"], {"linxoObservationId": None, "distinctFrom": list(set(a.get("distinctFrom", []) + [b["id"]]))})
            s.put("bank_observations", b["id"], {"enableObservationId": None, "canonicalId": None})
        elif kind == "confirm":
            if transition:
                if b.get('supersededBy') or a.get('canonicalId'):
                    raise BankingError('ALREADY_LINKED')
                s.put('bank_observations', a['id'], {'canonicalId': b.get('canonicalId'),
                    'linxoObservationId': b.get('linxoObservationId'), 'transitionCandidates': []})
                s.put('bank_observations', b['id'], {'supersededBy': a['id']})
                if b.get('linxoObservationId'):
                    s.put('bank_observations', b['linxoObservationId'], {'enableObservationId': a['id']})
                reconcile_unlocked(s)
                return {'status': 'success'}
            if (a.get("linxoObservationId") not in (None, b["id"]) or b.get("enableObservationId") not in (None, a["id"])):
                raise ValueError("ALREADY_LINKED")
            if a.get("canonicalId") and b.get("canonicalId") and a["canonicalId"] != b["canonicalId"]:
                keep = data.get('keepCanonicalId')
                if keep not in (a['canonicalId'], b['canonicalId']):
                    raise BankingError("EXISTING_ROWS_REQUIRE_REVIEW")
                discarded = b['canonicalId'] if keep == a['canonicalId'] else a['canonicalId']
                s.merge_rows(keep, discarded)
                s.put('bank_observations', a['id'], {'canonicalId': keep})
                s.put('bank_observations', b['id'], {'canonicalId': keep})
            s.put("bank_observations", a["id"], {"linxoObservationId": b["id"]})
            s.put("bank_observations", b["id"], {"enableObservationId": a["id"]})
        else:
            raise ValueError("INVALID_ACTION")
        reconcile_unlocked(s)
        update_balances(s)
        return {"status": "success"}
    return call(req, action)
