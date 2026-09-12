from datetime import datetime, timezone
import unittest

from tronity_importer import _compute_grid_energy_kwh, tronity_charge_to_dict, is_home_charge


class TronityImporterTests(unittest.TestCase):
    def test_compute_grid_energy_kwh(self):
        charged = 39.741
        grid = _compute_grid_energy_kwh(charged, 7.0)
        self.assertAlmostEqual(grid, 42.732258, places=6)

    def test_compute_grid_energy_kwh_negative_loss(self):
        charged = 40.0
        grid = _compute_grid_energy_kwh(charged, -7.0)
        self.assertAlmostEqual(grid, 37.383178, places=6)

    def test_tronity_charge_to_dict_keeps_charged_and_adds_grid_energy(self):
        session = {
            "id": "charge-1",
            "charged_energy": 39.741,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T22:00:00Z",
        }
        config = {
            "tarif_hp": 0.2470,
            "tarif_hc": 0.1941,
            "network_loss_percent": 7.0,
            "hc_plages": [],
        }
        tx = tronity_charge_to_dict(session, config, "EDF")
        self.assertIsNotNone(tx)
        self.assertEqual(tx["charged_energy"], 39.741)
        self.assertAlmostEqual(tx["grid_energy_kwh"], 42.7323, places=4)
        self.assertLess(tx["montant"], 0)

    def test_tronity_charge_to_dict_exposes_session_id(self):
        """tronity_session_id doit être exposé pour la dédup et l'ID de document."""
        session = {
            "id": "abc-session-42",
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T22:00:00Z",
        }
        config = {"tarif_hp": 0.247, "tarif_hc": 0.1941, "network_loss_percent": 7.0, "hc_plages": []}
        tx = tronity_charge_to_dict(session, config, "Voiture")
        self.assertIsNotNone(tx)
        self.assertEqual(tx["tronity_session_id"], "abc-session-42")

    def test_tronity_charge_to_dict_session_id_empty_string_when_missing(self):
        """Session sans champ 'id' → tronity_session_id vide, pas d'erreur."""
        session = {
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T22:00:00Z",
        }
        config = {"tarif_hp": 0.247, "tarif_hc": 0.1941, "network_loss_percent": 7.0, "hc_plages": []}
        tx = tronity_charge_to_dict(session, config, "Voiture")
        self.assertIsNotNone(tx)
        self.assertEqual(tx["tronity_session_id"], "")

    def test_tronity_charge_to_dict_supports_legacy_kwh_field(self):
        session = {
            "id": "charge-legacy",
            "kWh": 20.0,
            "startTime": datetime(2026, 4, 6, 20, 0, tzinfo=timezone.utc).isoformat(),
            "endTime": datetime(2026, 4, 6, 21, 0, tzinfo=timezone.utc).isoformat(),
        }
        config = {
            "tarif_hp": 0.2470,
            "tarif_hc": 0.1941,
            "network_loss_percent": 7.0,
            "hc_plages": [],
        }
        tx = tronity_charge_to_dict(session, config, "EDF")
        self.assertIsNotNone(tx)
        self.assertEqual(tx["charged_energy"], 20.0)
        self.assertAlmostEqual(tx["grid_energy_kwh"], 21.5054, places=4)

    def _base_config(self, **overrides):
        config = {
            "tarif_hp": 0.2470,
            "tarif_hc": 0.1941,
            "network_loss_percent": 7.0,
            "hc_plages": [],
        }
        config.update(overrides)
        return config

    def test_home_scope_no_gps_adds_verification_note(self):
        session = {
            "id": "no-gps",
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T21:00:00Z",
        }
        tx = tronity_charge_to_dict(session, self._base_config(import_scope="home"), "EDF")
        self.assertIsNotNone(tx)
        self.assertIn("Localisation GPS absente", tx["commentaire"])

    def test_home_scope_non_numeric_gps_adds_verification_note(self):
        session = {
            "id": "bad-gps",
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T21:00:00Z",
            "lat": "invalid",
            "lng": "invalid",
        }
        tx = tronity_charge_to_dict(session, self._base_config(import_scope="home"), "EDF")
        self.assertIsNotNone(tx)
        self.assertIn("Localisation GPS absente", tx["commentaire"])

    def test_home_scope_with_gps_no_note(self):
        session = {
            "id": "gps",
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T21:00:00Z",
            "lat": 48.8567,
            "lng": 2.3523,
        }
        tx = tronity_charge_to_dict(session, self._base_config(import_scope="home"), "EDF")
        self.assertIsNotNone(tx)
        self.assertNotIn("Localisation GPS absente", tx["commentaire"])

    def test_all_scope_no_verification_note(self):
        session = {
            "id": "no-gps",
            "charged_energy": 20.0,
            "startTime": "2026-04-06T20:00:00Z",
            "endTime": "2026-04-06T21:00:00Z",
        }
        tx = tronity_charge_to_dict(session, self._base_config(import_scope="all"), "EDF")
        self.assertIsNotNone(tx)
        self.assertNotIn("Localisation GPS absente", tx["commentaire"])


class IsHomeChargeTests(unittest.TestCase):
    HOME_LAT = 48.8566
    HOME_LON = 2.3522

    def test_no_gps_assumes_home(self):
        """Session sans GPS → assumée domicile (l'API Tronity ne retourne pas toujours le GPS)."""
        session = {"id": "no-gps"}
        self.assertTrue(is_home_charge(session, self.HOME_LAT, self.HOME_LON, 0.15))

    def test_within_radius_is_home(self):
        session = {"id": "home", "lat": 48.8567, "lng": 2.3523}
        self.assertTrue(is_home_charge(session, self.HOME_LAT, self.HOME_LON, 0.15))

    def test_outside_radius_is_not_home(self):
        session = {"id": "away", "lat": 48.9, "lng": 2.4}
        self.assertFalse(is_home_charge(session, self.HOME_LAT, self.HOME_LON, 0.15))

    def test_nested_location_object(self):
        session = {"id": "nested", "location": {"lat": 48.8567, "lng": 2.3523}}
        self.assertTrue(is_home_charge(session, self.HOME_LAT, self.HOME_LON, 0.15))


if __name__ == "__main__":
    unittest.main()
