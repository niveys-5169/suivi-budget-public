"""Secret declarations kept stable when the Functions entrypoint is reloaded."""
from firebase_functions.params import SecretParam

EB_APP_ID_SECRET = SecretParam("EB_APP_ID")
EB_PRIVATE_KEY_SECRET = SecretParam("EB_PRIVATE_KEY")
