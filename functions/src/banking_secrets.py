"""Secret declarations kept stable when the Functions entrypoint is reloaded."""
from firebase_functions.params import SecretParam

EB_APP_ID_SECRET = SecretParam("EB_APP_ID")
EB_PRIVATE_KEY_SECRET = SecretParam("EB_PRIVATE_KEY")
GMAIL_TOKEN_SECRET = SecretParam("GMAIL_TOKEN")
GITHUB_DISPATCH_TOKEN_SECRET = SecretParam("GITHUB_DISPATCH_TOKEN")
