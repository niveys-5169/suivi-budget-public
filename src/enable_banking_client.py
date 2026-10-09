"""Enable Banking AIS client. Private RSA key never leaves the server."""
import base64
import json
import os
import time
from urllib.parse import quote

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

AUTH_ERRORS = {"EXPIRED_SESSION", "CLOSED_SESSION", "REVOKED_SESSION", "SESSION_DOES_NOT_EXIST",
               "ASPSP_PSU_ACTION_REQUIRED", 'CANCELLED_SESSION', 'SESSION_NOT_AUTHORIZED'}


class BankingError(RuntimeError):
    def __init__(self, code, temporary=False):
        self.code, self.temporary = code, temporary
        super().__init__(code)  # Never include response bodies, auth URLs or tokens.


class EnableBankingClient:
    def __init__(self, app_id=None, private_key=None, transport=None):
        self.app_id = app_id or os.environ.get("EB_APP_ID", "")
        key = private_key or os.environ.get("EB_PRIVATE_KEY", "")
        if not self.app_id or not key:
            raise BankingError("CONFIGURATION_REQUIRED")
        try:
            self.key = serialization.load_pem_private_key(key.replace("\\n", "\n").encode(), password=None)
        except (ValueError, TypeError):
            raise BankingError("INVALID_PRIVATE_KEY") from None
        if not isinstance(self.key, rsa.RSAPrivateKey) or self.key.key_size < 2048:
            raise BankingError('INVALID_PRIVATE_KEY')
        self.transport = transport or requests.Session()

    def token(self):
        def encode(value):
            return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=")
        now = int(time.time())
        message = b".".join([encode({"typ": "JWT", "alg": "RS256", "kid": self.app_id}),
                             encode({"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 300})])
        signature = self.key.sign(message, padding.PKCS1v15(), hashes.SHA256())
        return (message + b"." + base64.urlsafe_b64encode(signature).rstrip(b"=")).decode()

    def request(self, method, path, **kwargs):
        for attempt in range(3):
            try:
                response = self.transport.request(method, "https://api.enablebanking.com" + path,
                                                  headers={"Authorization": "Bearer " + self.token()},
                                                  timeout=(5, 30), **kwargs)
            except requests.RequestException:
                error = BankingError("NETWORK_ERROR", True)
            else:
                if response.ok:
                    try:
                        return response.json()
                    except ValueError:
                        raise BankingError("INVALID_RESPONSE") from None
                try:
                    code = response.json().get("error", "API_ERROR")
                except ValueError:
                    code = "API_ERROR"
                error = BankingError(str(code), response.status_code in (408, 429) or response.status_code >= 500)
            # Do not retry code exchange / auth creation: outcome may be unknown.
            if method != "GET" or not error.temporary or attempt == 2:
                raise error
            time.sleep(2 ** attempt)

    def banks(self):
        return self.request("GET", "/aspsps", params={"country": "FR"}).get("aspsps", [])

    def application(self):
        return self.request("GET", "/application")

    def start_auth(self, bank, state, redirect_url, valid_until, owner):
        return self.request("POST", "/auth", json={"aspsp": {"name": bank, "country": "FR"},
            "state": state, "redirect_url": redirect_url, "psu_type": "personal", "psu_id": owner,
            "language": "fr", "access": {"valid_until": valid_until, "balances": True, "transactions": True}})

    def create_session(self, code):
        return self.request("POST", "/sessions", json={"code": code})

    def session(self, session_id):
        return self.request("GET", "/sessions/" + quote(session_id, safe=""))

    def balances(self, account_id):
        return self.request("GET", "/accounts/" + quote(account_id, safe="") + "/balances").get("balances", [])

    def transactions(self, account_id, date_from):
        items, seen, continuation = [], set(), None
        for _ in range(200):
            params = {"date_from": date_from}
            if continuation:
                params["continuation_key"] = continuation
            page = self.request("GET", "/accounts/" + quote(account_id, safe="") + "/transactions", params=params)
            items.extend(page.get("transactions", []))
            continuation = page.get("continuation_key")
            if not continuation:
                return items
            if continuation in seen:
                break
            seen.add(continuation)
        raise BankingError("INCOMPLETE_PAGINATION")
