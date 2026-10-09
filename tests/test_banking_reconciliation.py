from datetime import datetime, timedelta, timezone

from bank_reconciliation import reconcile, confirmation_status


NOW = datetime(2026, 10, 9, 8, tzinfo=timezone.utc)


def observation(id, source, **changes):
    return {"id": id, "source": source, "compte": "LCL", "currency": "EUR",
            "montant": -42, "date": "2026-10-01", "libelle": "Café Paris",
            "bankStatus": "booked", "firstBookedAt": NOW - timedelta(days=8), **changes}


def test_late_linxo_confirms_without_losing_two_equal_payments():
    eb = [observation("eb1", "enable_banking"), observation("eb2", "enable_banking")]
    linxo = [observation("lx1", "gmail")]
    result = reconcile(eb, linxo)
    assert result["matches"] == []
    assert len(result["suggestions"]) == 2


def test_unique_original_label_matches_despite_accents_and_late_arrival():
    result = reconcile([observation("eb1", "enable_banking")],
                       [observation("lx1", "gmail", libelle="CAFE PARIS", date="2026-10-04")])
    assert result["matches"] == [("eb1", "lx1")]


def test_pending_has_no_missing_alert_and_deadline_does_not_restart():
    pending = observation("eb1", "enable_banking", bankStatus="pending")
    assert confirmation_status(pending, NOW) == "waiting"
    assert confirmation_status(observation("eb1", "enable_banking"), NOW) == "overdue"
    assert confirmation_status(observation("eb1", "enable_banking", linxoObservationId="lx"), NOW) == "matched"
