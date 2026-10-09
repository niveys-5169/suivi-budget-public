"""Default to observation until production prerequisites are verified."""
import os


def banking_mode(store=None):
    value = os.environ.get('EB_MODE')
    if value is None and store is not None:
        value = (store.get('bank_runtime', 'config') or {}).get('mode')
    value = value or 'observation'
    return value if value in ('disabled', 'observation', 'active') else 'disabled'
