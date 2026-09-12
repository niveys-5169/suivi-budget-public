import logging
from firebase_functions import https_fn
from firebase_admin import firestore
from .firebase_db import _get_db, _run_with_backoff
from .auth import require_owner

log = logging.getLogger(__name__)

def record_reconciliation_action_logic(req: https_fn.CallableRequest) -> dict:
    """
    User-initiated reconciliation action logic.
    Processes manual choices, overrides, and acknowledgements.
    """
    # 1. Security: réservé au propriétaire du compte (auth + UID).
    require_owner(req)

    data = req.data
    account_id = data.get("accountId")
    event_type = data.get("eventType")
    is_savings = data.get("isSavings", False)
    
    if not account_id or not event_type:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Missing accountId or eventType"
        )

    db = _get_db()
    user_id = req.auth.uid

    def perform_transactional_update():
        target_collection = "savings_balances" if is_savings else "account_balances"
        account_ref = db.collection(target_collection).document(account_id)

        @firestore.transactional
        def update_in_transaction(transaction):
            snapshot = account_ref.get(transaction=transaction)
            if not snapshot.exists:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.NOT_FOUND,
                    message=f"Account {account_id} not found"
                )
            
            account_data = snapshot.to_dict()
            old_balance = account_data.get("current_balance", account_data.get("solde", 0))
            new_balance = old_balance
            new_source = account_data.get("source", "manual")
            new_status = account_data.get("status", "reconciled")
            discrepancies = account_data.get("discrepancies", [])
            
            audit_details = {
                "user_id": user_id,
                "event_type": event_type,
                "old_balance": old_balance
            }

            if event_type == "reconciled_user_choice":
                new_balance = data.get("chosenValue")
                new_source = data.get("chosenSource")
                if new_balance is None or not new_source:
                    raise https_fn.HttpsError(
                        code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                        message="Missing chosenValue or chosenSource"
                    )
                
                # Resolving a choice usually resolves all current discrepancies for that point in time
                new_status = "reconciled"
                discrepancies = []
                audit_details.update({"chosen_value": new_balance, "chosen_source": new_source})

            elif event_type == "reconciled_manual_override":
                new_balance = data.get("manualValue")
                if new_balance is None:
                    raise https_fn.HttpsError(
                        code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                        message="Missing manualValue"
                    )
                new_source = "manual_override"
                new_status = "reconciled"
                discrepancies = []
                audit_details.update({"manual_value": new_balance})

            elif event_type == "reconciled_manual_confirm":
                new_status = "reconciled"
                discrepancies = []
                audit_details.update({
                    "action": "confirmed_current_balance",
                    "confirmed_value": old_balance,
                    "confirmed_source": new_source,
                })

            elif event_type == "discrepancy_acknowledged":
                # Clear all discrepancies on validation — the user has reviewed and accepted them.
                discrepancies = []
                new_status = "reconciled"
                audit_details.update({"action": "acknowledged_all"})

            else:
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                    message=f"Unknown event type: {event_type}"
                )

            # Update Account
            update_payload = {
                "current_balance": new_balance,
                "solde": new_balance,
                "source": new_source,
                "status": new_status,
                "discrepancies": discrepancies,
                "last_reconciled_date": firestore.SERVER_TIMESTAMP,
                "last_updated": firestore.SERVER_TIMESTAMP,
                # Ancre temporelle de la réconciliation : le solde validé par
                # l'utilisateur fait foi à cet instant. calcul_coherence_solde
                # s'appuie sur emailDate pour ne compter QUE les transactions
                # postérieures ; sans ce réancrage, un solde forcé conservait
                # un emailDate obsolète (ou aucun), faussant l'écart et basculant
                # le compte en "pending_review" à tort au prochain import.
                "emailDate": firestore.SERVER_TIMESTAMP,
            }
            
            # Clear legacy audit/coherence fields upon successful reconciliation
            if new_status == "reconciled":
                update_payload.update({
                    "ecart": firestore.DELETE_FIELD,
                    "computedSolde": firestore.DELETE_FIELD,
                    "linxoDelta": firestore.DELETE_FIELD,
                    "previousSolde": firestore.DELETE_FIELD,
                    "cross_ecart": firestore.DELETE_FIELD,
                    "cross_status": firestore.DELETE_FIELD,
                })

            transaction.update(account_ref, update_payload)

            # Log to History
            history_ref = db.collection("account_balance_history").document()
            transaction.set(history_ref, {
                "account_id": account_id,
                "balance_value": new_balance,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "event_type": event_type,
                "source": "reconciliation_ui",
                "previous_balance": old_balance,
                "discrepancy_details": audit_details,
                "user_id": user_id
            })

            return {"status": "success", "newBalance": new_balance}

        return update_in_transaction(db.transaction())

    try:
        result = _run_with_backoff(perform_transactional_update, f"RecordReconciliation_{account_id}")
        log.info(f"Successfully recorded reconciliation action '{event_type}' for account {account_id}")
        return result
    except Exception as e:
        log.exception(f"Error recording reconciliation action for {account_id}")
        if isinstance(e, https_fn.HttpsError):
            raise e
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=str(e)
        )
