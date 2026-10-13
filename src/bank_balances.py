"""Compare balance evidence without inventing a bank timestamp for an email."""
from bank_reconciliation import cents, instant

BOOKED = {"ITBD", "CLBD", "booked"}


def choose_enable_balance(balances):
    order = {"ITBD": 0, "CLBD": 1, "XPCD": 2, "ITAV": 3, "CLAV": 4}
    supported = [b for b in balances if b.get("balance_type") in order]
    def priority(balance):
        date = instant(balance.get('reference_date')) or instant(balance.get('last_change_date_time'))
        # Current/expected accounting balances precede available balances. Within
        # that group, freshness wins; equal dates prefer a booked balance.
        return (balance['balance_type'] not in BOOKED | {'XPCD'},
                -date.timestamp() if date else float('inf'), order[balance['balance_type']])
    return min(supported, key=priority) if supported else None


def compare_balances(eb, linxo, observations):
    if not eb or not linxo:
        return {"status": "waiting", "reason": "Source manquante", "difference": None}
    diff = (cents(eb["solde"]) - cents(linxo["solde"])) / 100
    if eb.get('currency') != linxo.get('currency'):
        return {'status': 'waiting', 'reason': 'Devises incompatibles', 'difference': None}
    if eb.get('balanceType') == 'XPCD':
        return {'status': 'waiting', 'difference': diff, 'provisional': True,
                'reason': 'Solde bancaire provisoire : comparaison comptable non définitive'}
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
