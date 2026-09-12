"""Tests unitaires des helpers temporels du client Tronity.

Cible les méthodes statiques pures de src/tronity_client.py (normalisation
epoch ms→s, parsing de date tolérant, filtrage des sessions de recharge par
fenêtre temporelle) — jusqu'ici non testées.
"""

from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import MagicMock, patch

from tronity_client import TronityClient


class CoerceEpochSecondsTests(unittest.TestCase):
    def test_milliseconds_converted_to_seconds(self):
        self.assertEqual(TronityClient._coerce_epoch_seconds(1_700_000_000_000), 1_700_000_000)

    def test_seconds_left_untouched(self):
        self.assertEqual(TronityClient._coerce_epoch_seconds(1_700_000_000), 1_700_000_000)

    def test_none_left_untouched(self):
        self.assertIsNone(TronityClient._coerce_epoch_seconds(None))

    def test_zero_left_untouched(self):
        self.assertEqual(TronityClient._coerce_epoch_seconds(0), 0)


class ParseTronityDatetimeTests(unittest.TestCase):
    def test_iso_with_z_suffix(self):
        dt = TronityClient._parse_tronity_datetime("2026-04-06T22:00:00Z")
        self.assertEqual(dt, datetime(2026, 4, 6, 22, 0, tzinfo=timezone.utc))

    def test_iso_with_offset_normalized_to_utc(self):
        dt = TronityClient._parse_tronity_datetime("2026-04-06T22:00:00+02:00")
        self.assertEqual(dt, datetime(2026, 4, 6, 20, 0, tzinfo=timezone.utc))

    def test_epoch_seconds_string(self):
        expected = datetime(2026, 4, 6, 22, 0, tzinfo=timezone.utc)
        dt = TronityClient._parse_tronity_datetime(str(int(expected.timestamp())))
        self.assertEqual(dt, expected)

    def test_epoch_milliseconds_string_downscaled(self):
        expected = datetime(2026, 4, 6, 22, 0, tzinfo=timezone.utc)
        dt = TronityClient._parse_tronity_datetime(str(int(expected.timestamp()) * 1000))
        self.assertEqual(dt, expected)

    def test_none_returns_none(self):
        self.assertIsNone(TronityClient._parse_tronity_datetime(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(TronityClient._parse_tronity_datetime("   "))

    def test_garbage_returns_none(self):
        self.assertIsNone(TronityClient._parse_tronity_datetime("not-a-date"))


class FilterChargesByTsTests(unittest.TestCase):
    def _charges(self):
        return [
            {"id": "a", "endTime": "2026-01-10T12:00:00Z"},
            {"id": "b", "endTime": "2026-03-10T12:00:00Z"},
            {"id": "c", "endTime": "2026-06-10T12:00:00Z"},
        ]

    def test_no_bounds_returns_all(self):
        result = TronityClient._filter_charges_by_ts(self._charges(), None, None)
        self.assertEqual([c["id"] for c in result], ["a", "b", "c"])

    def test_from_ts_excludes_earlier(self):
        from_ts = datetime(2026, 2, 1, tzinfo=timezone.utc).timestamp()
        result = TronityClient._filter_charges_by_ts(self._charges(), from_ts, None)
        self.assertEqual([c["id"] for c in result], ["b", "c"])

    def test_to_ts_excludes_later(self):
        to_ts = datetime(2026, 4, 1, tzinfo=timezone.utc).timestamp()
        result = TronityClient._filter_charges_by_ts(self._charges(), None, to_ts)
        self.assertEqual([c["id"] for c in result], ["a", "b"])

    def test_window_keeps_only_inside(self):
        from_ts = datetime(2026, 2, 1, tzinfo=timezone.utc).timestamp()
        to_ts = datetime(2026, 4, 1, tzinfo=timezone.utc).timestamp()
        result = TronityClient._filter_charges_by_ts(self._charges(), from_ts, to_ts)
        self.assertEqual([c["id"] for c in result], ["b"])

    def test_unparseable_endtime_is_kept(self):
        charges = [{"id": "x", "endTime": "garbage"}]
        from_ts = datetime(2026, 2, 1, tzinfo=timezone.utc).timestamp()
        result = TronityClient._filter_charges_by_ts(charges, from_ts, None)
        self.assertEqual([c["id"] for c in result], ["x"])


class GetChargesPaginationTests(unittest.TestCase):
    """L'API Tronity ignore parfois `offset` et renvoie toujours la même page.

    Sans garde-fou, la pagination rappelait alors `max_pages` fois les mêmes
    sessions : chaque recharge était importée 200 fois.
    """

    def _client(self):
        with patch.dict("os.environ", {"TRONITY_CLIENT_ID": "id", "TRONITY_CLIENT_SECRET": "secret"}):
            client = TronityClient()
        client._headers = lambda: {}
        return client

    @staticmethod
    def _page(count, start_index=0):
        base = datetime.now(timezone.utc) - timedelta(days=1)
        return [
            {
                "id": f"session-{start_index + i}",
                "endTime": (base - timedelta(minutes=i)).isoformat().replace("+00:00", "Z"),
                "charged_energy": 5.0,
            }
            for i in range(count)
        ]

    def _run(self, client, pages):
        responses = []
        for page in pages:
            resp = MagicMock()
            resp.json.return_value = {"data": page}
            responses.append(resp)
        client._request_with_retry = MagicMock(side_effect=responses)
        return client.get_charges("veh-1", from_ts=None, to_ts=None)

    def test_repeated_page_stops_pagination_without_duplicates(self):
        client = self._client()
        page = self._page(50)
        # 3 réponses suffisent : la 2e (identique) doit interrompre la boucle.
        charges = self._run(client, [page, page, page])

        self.assertEqual(len(charges), 50)
        self.assertEqual(len({c["id"] for c in charges}), 50)
        self.assertEqual(client._request_with_retry.call_count, 2)

    def test_distinct_pages_are_all_collected(self):
        client = self._client()
        charges = self._run(
            client,
            [self._page(50), self._page(50, start_index=50), self._page(10, start_index=100)],
        )

        self.assertEqual(len(charges), 110)
        self.assertEqual(len({c["id"] for c in charges}), 110)

    def test_partially_overlapping_page_keeps_only_new_sessions(self):
        client = self._client()
        charges = self._run(client, [self._page(50), self._page(50, start_index=40), []])

        self.assertEqual(len(charges), 90)
        self.assertEqual(len({c["id"] for c in charges}), 90)


class ChargeKeyTests(unittest.TestCase):
    def test_id_used_when_present(self):
        self.assertEqual(TronityClient._charge_key({"id": "abc", "kWh": 1}), "abc")

    def test_sessions_without_id_are_distinguished_by_content(self):
        k1 = TronityClient._charge_key({"endTime": "2026-09-06T10:00:00Z", "kWh": 5})
        k2 = TronityClient._charge_key({"endTime": "2026-09-06T12:00:00Z", "kWh": 5})
        self.assertNotEqual(k1, k2)

    def test_same_session_without_id_gives_same_key(self):
        charge = {"endTime": "2026-09-06T10:00:00Z", "kWh": 5}
        self.assertEqual(TronityClient._charge_key(dict(charge)), TronityClient._charge_key(dict(charge)))


if __name__ == "__main__":
    unittest.main()
