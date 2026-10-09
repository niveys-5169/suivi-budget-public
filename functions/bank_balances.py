"""Compare balance evidence without inventing a bank timestamp for an email."""
from bank_reconciliation import cents, instant

BOOKED = {"ITBD", "CLBD", "booked"}


def choose_enable_balance(balances):
    order = {"ITBD": 0, "CLBD": 1, "ITAV": 2, "CLAV": 3}
    supported = [b for b in balances if b.get("balance_type") in order]
    return min(supported, key=lambda b: order[b["balance_type"]]) if supported else None


def compare_balances(eb, linxo, observations):
    if not eb or not linxo:
        return {"status": "waiting", "reason": "Source manquante", "difference": None}
    diff = (cents(eb["solde"]) - cents(linxo["solde"])) / 100
    if eb.get('currency') != linxo.get('currency'):
        return {'status': 'waiting', 'reason': 'Devises incompatibles', 'difference': None}
    comparable = (eb.get("currency") == linxo.get("currency") and eb.get("balanceType") in BOOKED
                  and linxo.get("balanceType") in BOOKED and eb.get("bankDate") and linxo.get("bankDate")
                  and eb["bankDate"] == linxo["bankDate"])
    if comparable:
        return {"status": "concordant" if abs(diff) <= .01 else "discrepancy", "difference": diff}
    # An explained difference is provisional when Linxo supplies no bank date/type.
    low, high = instant(linxo.get('bankDate')), instant(eb.get('bankDate'))
    dated = low and high and high >= low and eb.get('balanceType') in BOOKED and linxo.get('balanceType') in BOOKED
    missing = [o for o in observations if o.get("source") == "enable_banking" and o.get("bankStatus") == "booked"
               and not o.get('supersededBy') and o.get("compte") == eb["compte"]
               and ((dated and instant(o.get('date')) and low < instant(o['date']) <= high) or
                    (not dated and not o.get('linxoObservationId') and instant(o.get('firstBookedAt'))
                     and instant(linxo.get('receivedAt')) and instant(eb.get('receivedAt'))
                     and instant(linxo['receivedAt']) < instant(o['firstBookedAt']) <= instant(eb['receivedAt'])))]
    movement = sum(cents(o["montant"]) for o in missing) / 100
    if missing and abs(diff - movement) <= .01:
        return {"status": "explained", "difference": diff, "provisional": True,
                "reason": "Compatible avec les mouvements observés entre les relevés ; contrôle provisoire", "observationIds": [o["id"] for o in missing],
                'movements': [{'id': o['id'], 'libelle': o['libelle'], 'montant': o['montant'], 'date': o['date']} for o in missing]}
    return {"status": "waiting", "difference": diff, "reason": "Date bancaire ou nature du solde Linxo inconnue"}


def select_balance(eb, linxo, enabled, available):
    if not enabled:
        return linxo or eb
    if enabled and available and eb:
        return eb
    if not eb:
        return linxo
    ed, ld = instant(eb.get("bankDate")), instant((linxo or {}).get("bankDate"))
    return linxo if ed and ld and ld >= ed else eb
