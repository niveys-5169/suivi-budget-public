"""Print production counts/statuses only; credentials and source data stay private."""
import contextlib
import io
import json
import logging
import os
import sys
from collections import Counter
from pathlib import Path

from google.auth.transport.requests import AuthorizedSession
from google.oauth2.service_account import Credentials
from google.cloud import firestore

ROOT = Path(__file__).resolve().parents[2]


def prepare_links():
    sys.path.insert(0, str(ROOT / 'scripts'))
    import bootstrap_banking_observations
    sys.argv = ['bootstrap_banking_observations.py', '--apply-links']
    logging.disable(logging.CRITICAL)
    output = io.StringIO()
    try:
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
            bootstrap_banking_observations.main()
        result = json.loads(output.getvalue())
        print(json.dumps({key: result[key] for key in
                          ('mode', 'financialWrites', 'enableCount', 'linxoCount',
                           'staleLinxoBalancesBefore', 'staleLinxoBalancesAfter')} | {
            'certainMatches': len(result['matches']), 'suggestions': len(result['suggestions'])}))
    except Exception:
        print('Historical source preparation failed; private diagnostic output suppressed.')
        raise SystemExit(1) from None


def main():
    if '--prepare-links' in sys.argv:
        return prepare_links()
    credentials = Credentials.from_service_account_info(json.loads(os.environ['FIREBASE_CREDENTIALS']),
        scopes=['https://www.googleapis.com/auth/cloud-platform'])
    db = firestore.Client(project=credentials.project_id, credentials=credentials)
    rows = lambda collection: [doc.to_dict() for doc in db.collection(collection).stream()]
    connections = rows('bank_connections')
    runs = list(db.collection('bank_sync_runs').order_by('startedAt', direction=firestore.Query.DESCENDING).limit(3).stream())
    report = {'runtimeMode': (db.collection('bank_runtime').document('config').get().to_dict() or {}).get('mode'),
        'connections': [{'bank': c.get('bank'), 'mode': c.get('mode'), 'status': c.get('status'),
            'mappedAccounts': sum(bool(a.get('compte')) for a in c.get('accounts', [])),
            'enabledAccounts': sum(bool(a.get('compte') and a.get('enabled')) for a in c.get('accounts', [])),
            'lastSuccessAt': c.get('lastSuccessAt'), 'errorCode': c.get('errorCode')} for c in connections],
        'latestRuns': [{'status': r.get('status'), 'mode': r.get('mode'), 'imported': r.get('imported'),
            'startedAt': r.get('startedAt'), 'errorCode': r.get('errorCode'),
            'sourceStatuses': dict(Counter(r.get('sources', {}).values()))} for r in [d.to_dict() for d in runs]],
        'observationSources': dict(Counter(o.get('source') for o in rows('bank_observations'))),
        'displayedBalanceSources': dict(Counter(b.get('source') for b in rows('account_balances'))),
        'balanceControlStatuses': dict(Counter(r.get('status') for r in rows('bank_reports') if r.get('monitoringEnabled')))}
    session = AuthorizedSession(credentials)
    response = session.get(f'https://cloudscheduler.googleapis.com/v1/projects/{credentials.project_id}/locations/europe-west1/jobs', timeout=30)
    response.raise_for_status()
    report['bankingSchedules'] = [{key: job.get(key) for key in ('schedule', 'timeZone', 'state')}
        for job in response.json().get('jobs', []) if 'scheduled_banking_sync' in job.get('name', '')]
    print(json.dumps(report, default=str, indent=2))


if __name__ == '__main__':
    main()
