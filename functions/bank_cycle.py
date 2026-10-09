"""Retain recurrence approval evidence while neutralizing explicitly cancelled links."""


def update_linked_approvals(store, canonical_id):
    row = store.get('transactions', canonical_id)
    if not row:
        return
    cancelled = row.get('bankStatus') == 'cancelled'
    for recurrence in store.all('recurrences'):
        approvals = recurrence.get('approvedMonths', {})
        if not any(a.get('txId') == canonical_id or any(e.get('txId') == canonical_id for e in a.get('entries', []))
                   for a in approvals.values() if a):
            continue
        def update(previous):
            months, changed = dict(previous.get('approvedMonths', {})), False
            for key, approval in months.items():
                if not approval:
                    continue
                value = dict(approval)
                entries = [dict(e) for e in value.get('entries', [])]
                if entries:
                    for entry in entries:
                        if entry.get('txId') == canonical_id and bool(entry.get('bankCancelled')) != cancelled:
                            entry['bankCancelled'] = cancelled
                            changed = True
                    value['entries'] = entries
                    value['bankCancelled'] = all(e.get('bankCancelled') for e in entries)
                elif value.get('txId') == canonical_id and bool(value.get('bankCancelled')) != cancelled:
                    value['bankCancelled'], changed = cancelled, True
                months[key] = value
            return ({'approvedMonths': months} if changed else None), None
        store.atomic('recurrences', recurrence['id'], update)
