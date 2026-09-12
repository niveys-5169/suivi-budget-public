import json
import logging
import os
import random
import time
from datetime import datetime, timezone, timedelta
import requests

log = logging.getLogger(__name__)
BASE_URL = "https://api.tronity.tech"

class TronityClient:
    def __init__(self):
        self.client_id = os.environ.get("TRONITY_CLIENT_ID", "")
        self.client_secret = os.environ.get("TRONITY_CLIENT_SECRET", "")
        if not self.client_id or not self.client_secret:
            raise ValueError("TRONITY_CLIENT_ID et TRONITY_CLIENT_SECRET sont requis.")
        self._token = None
        self._token_expiry = None

    def _authenticate(self):
        resp = requests.post(
            f"{BASE_URL}/authentication",
            json={"client_id": self.client_id, "client_secret": self.client_secret, "grant_type": "app"},
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data.get("access_token") or data.get("token")
        if "expiry" in data:
            try:
                self._token_expiry = datetime.fromisoformat(data["expiry"].replace("Z", "+00:00"))
            except ValueError: self._token_expiry = None
        elif "expires_in" in data:
            self._token_expiry = datetime.now(timezone.utc) + timedelta(seconds=int(data["expires_in"]) - 60)
        log.info("Tronity : token obtenu (expire le %s)", self._token_expiry)

    def _get_token(self):
        if self._token is None or (self._token_expiry and datetime.now(timezone.utc) >= self._token_expiry):
            self._authenticate()
        return self._token

    def _headers(self):
        return {"Authorization": f"Bearer {self._get_token()}"}

    def _request_with_retry(self, method, url, max_retries=4, **kwargs):
        # (10s connect, 20s read) — fail fast on unresponsive server
        kwargs.setdefault("timeout", (10, 20))
        for attempt in range(max_retries):
            try:
                resp = requests.request(method, url, **kwargs)
                if resp.status_code in (429, 500, 503) and attempt < max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    log.warning("API %s, retry dans %.1fs…", resp.status_code, wait)
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1: raise e
                wait = (2 ** attempt) + random.uniform(0, 1)
                log.warning("Tronity: erreur réseau (%s), retry %d/%d dans %.1fs…",
                            type(e).__name__, attempt + 1, max_retries, wait)
                time.sleep(wait)
        return None

    def get_vehicles(self):
        resp = self._request_with_retry("GET", f"{BASE_URL}/tronity/vehicles", headers=self._headers())
        data = resp.json()
        return data.get("data", []) if isinstance(data, dict) else data

    def get_charges(self, vehicle_id, from_ts=None, to_ts=None, max_pages=200):
        """Paginate through Tronity charges (API ignores from/to params).

        Fetches pages of ``limit=50`` using ``offset`` until a charge's
        ``endTime`` predates ``from_ts``, then filters locally.
        ``max_pages`` caps pagination to avoid hanging indefinitely.

        L'API renvoie parfois la même page quel que soit ``offset``. Sans
        garde-fou, la boucle réclame alors ``max_pages`` fois les mêmes
        sessions et chaque recharge est importée autant de fois. On
        dédoublonne donc par session et on s'arrête dès qu'une page
        n'apporte plus rien de neuf.
        """
        url = f"{BASE_URL}/tronity/vehicles/{vehicle_id}/charges"
        LIMIT = 50
        offset = 0
        all_charges = []
        seen_keys = set()
        page_num = 0

        while True:
            page_num += 1
            if page_num > max_pages:
                log.warning(
                    "Tronity: limite de %d pages atteinte — arrêt prématuré de la pagination "
                    "(%d sessions récupérées). Augmenter max_pages si nécessaire.",
                    max_pages, len(all_charges),
                )
                break

            params = {"limit": LIMIT, "offset": offset}
            log.debug("Tronity: page %d (offset=%d)…", page_num, offset)
            resp = self._request_with_retry("GET", url, headers=self._headers(), params=params)
            data = resp.json()
            page = data.get("data", []) if isinstance(data, dict) else data

            if not page:
                break

            nouvelles = []
            for charge in page:
                key = self._charge_key(charge)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                nouvelles.append(charge)

            if not nouvelles:
                log.warning(
                    "Tronity: page %d ne contient aucune session inédite (offset ignoré par "
                    "l'API ?) — arrêt de la pagination à %d session(s).",
                    page_num, len(all_charges),
                )
                break

            all_charges.extend(nouvelles)
            log.info("Tronity: page %d — %d sessions cumulées.", page_num, len(all_charges))

            # Stop pagination once we've reached charges older than from_ts
            if from_ts:
                for charge in page:
                    dt = self._parse_tronity_datetime(charge.get("endTime"))
                    if dt and dt.timestamp() < from_ts:
                        log.info("Tronity: arrêt pagination — endTime (%s) < from_ts", dt)
                        return self._filter_charges_by_ts(all_charges, from_ts, to_ts)

            if len(page) < LIMIT:
                break  # dernière page atteinte

            offset += LIMIT

        log.info("Tronity: %d sessions récupérées (pagination complète).", len(all_charges))
        return self._filter_charges_by_ts(all_charges, from_ts, to_ts)

    @staticmethod
    def _charge_key(charge):
        """Identité stable d'une session, pour ne pas la compter deux fois."""
        session_id = str(charge.get("id", "")).strip()
        if session_id:
            return session_id
        return json.dumps(charge, sort_keys=True, default=str)

    @staticmethod
    def _coerce_epoch_seconds(ts):
        if ts and ts >= 1_000_000_000_000: return int(ts / 1000)
        return ts

    @staticmethod
    def _filter_charges_by_ts(charges, from_ts, to_ts):
        result = []
        for s in charges:
            dt = TronityClient._parse_tronity_datetime(s.get("endTime"))
            if dt:
                ts = dt.timestamp()
                if from_ts and ts < from_ts: continue
                if to_ts and ts > to_ts: continue
            result.append(s)
        return result

    @staticmethod
    def _parse_tronity_datetime(ts_raw):
        if not ts_raw: return None
        raw = str(ts_raw).strip()
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
        except:
            try:
                epoch = float(raw)
                for _ in range(4):
                    try:
                        dt = datetime.fromtimestamp(epoch, tz=timezone.utc)
                        if 2000 <= dt.year <= 2100: return dt
                    except: pass
                    epoch /= 1000.0
            except: pass
        return None
