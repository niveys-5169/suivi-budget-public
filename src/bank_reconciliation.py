"""Pure, one-to-one reconciliation of original banking observations."""
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo


def cents(value):
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def instant(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    try:
        return instant(datetime.fromisoformat(str(value).replace("Z", "+00:00")))
    except (ValueError, TypeError):
        return None


def normalize_label(value):
    text = unicodedata.normalize("NFKD", str(value or "")).upper()
    return re.sub(r"[^A-Z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c))).strip()


def compatible(a, b):
    if not a.get("compte") or a.get("compte") != b.get("compte"):
        return False
    if a.get("currency", "EUR") != b.get("currency", "EUR") or cents(a["montant"]) != cents(b["montant"]):
        return False
    if a.get("reference") and a["reference"] == b.get("reference"):
        return True
    ad, bd = instant(str(a.get("date", ""))[:10]), instant(str(b.get("date", ""))[:10])
    return bool(ad and bd and abs((ad - bd).days) <= 7)


def strong_match(a, b):
    if not compatible(a, b):
        return False
    ref = a.get("reference")
    return bool((ref and ref == b.get("reference")) or (
        normalize_label(a.get("libelle")) and normalize_label(a.get("libelle")) == normalize_label(b.get("libelle"))))


def reconcile(eb, linxo):
    """No greedy match: certainty requires a unique candidate in BOTH directions."""
    candidates = [(a["id"], b["id"], strong_match(a, b)) for a in eb for b in linxo
                  if compatible(a, b) and b["id"] not in a.get("distinctFrom", [])]
    matches, suggestions = [], []
    for aid, bid, strong in candidates:
        unique_a = sum(1 for x, _, exact in candidates if x == aid and exact) == 1
        unique_b = sum(1 for _, y, exact in candidates if y == bid and exact) == 1
        if strong and unique_a and unique_b:
            matches.append((aid, bid))
        else:
            suggestions.append({"enableObservationId": aid, "linxoObservationId": bid})
    linked_a, linked_b = {a for a, _ in matches}, {b for _, b in matches}
    return {"matches": matches, "suggestions": [s for s in suggestions
            if s['enableObservationId'] not in linked_a and s['linxoObservationId'] not in linked_b]}


def confirmation_status(observation, now):
    if observation.get("linxoObservationId"):
        return "matched"
    if observation.get("bankStatus") != "booked":
        return "waiting"
    booked = instant(observation.get("firstBookedAt"))
    paris = ZoneInfo('Europe/Paris')
    return "overdue" if booked and (instant(now).astimezone(paris).date() - booked.astimezone(paris).date()).days >= 7 else "waiting"
