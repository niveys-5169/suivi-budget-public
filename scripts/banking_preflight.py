"""Read-only configuration checks. Never print key material or session IDs."""
import json
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from bank_auth import configured_urls
from bank_config import banking_mode
from enable_banking_client import EnableBankingClient, BankingError


def main():
    report = {'mode': banking_mode(), 'missing': [name for name in
        ('EB_APP_ID', 'EB_PRIVATE_KEY', 'EB_REDIRECT_URL', 'EB_APP_URL') if not os.environ.get(name)],
        'financialWrites': False}
    if not report['missing']:
        try:
            configured_urls()
            client = EnableBankingClient()
            application = client.application()
            report['applicationAccessible'] = True
            report['applicationEnvironment'] = application.get('environment')
            report['banksFR'] = [b['name'] for b in client.banks()]
            report['remainingChecks'] = ['Registered certificate matches the RSA private key',
                'Production application enabled for the required banks', 'Registered redirect URL matches EB_REDIRECT_URL',
                'Runtime service account has secretAccessor and Firestore access', 'Existing session validity per connection']
        except BankingError as error:
            report['errorCode'] = error.code
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report.get('missing') or report.get('errorCode') else 0


if __name__ == '__main__':
    raise SystemExit(main())
