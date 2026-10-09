"""A shared lease for canonical writes, mappings and user reconciliation."""
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from bank_reconciliation import instant
from enable_banking_client import BankingError


@contextmanager
def banking_write_lock(store):
    now, token = datetime.now(timezone.utc), uuid.uuid4().hex
    def claim(old):
        expiry = instant(old.get('expiresAt'))
        if expiry and expiry > now:
            raise BankingError('BANKING_BUSY', temporary=True)
        return {'token': token, 'expiresAt': now + timedelta(minutes=10)}, None
    store.atomic('bank_locks', 'writes', claim)
    try:
        yield
    finally:
        store.atomic('bank_locks', 'writes', lambda old: ({'expiresAt': now}, None)
                     if old.get('token') == token else (None, None))
