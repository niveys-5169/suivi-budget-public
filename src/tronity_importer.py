"""
tronity_importer.py — Import recharges domicile Tronity → Firebase
===================================================================

Récupère les sessions de recharge à domicile d'un véhicule électrique
via l'API Tronity, calcule le coût en tenant compte des tarifs HP/HC
(lus depuis Firestore, configurables dans le dashboard), et sauvegarde
les transactions dans Firestore en réutilisant la logique firebase_db.py.

Le calcul du coût est fait en prorata : pour une session à cheval sur des
plages HP et HC, les kWh sont répartis proportionnellement au temps passé
dans chaque plage, puis multipliés par le tarif correspondant.

Variables d'environnement requises :
  TRONITY_CLIENT_ID      : Client ID Tronity
  TRONITY_CLIENT_SECRET  : Client Secret Tronity
  TRONITY_COMPTE         : Nom du compte budget pour les recharges (ex: "Voiture")
  TRONITY_HOME_LAT       : Latitude du domicile (ex: "48.8566")
  TRONITY_HOME_LON       : Longitude du domicile (ex: "2.3522")
  FIREBASE_CREDENTIALS   : Service account Firebase (JSON)

Variables optionnelles :
  TRONITY_VEHICLE_ID     : ID véhicule (auto-découverte si absent)
  TRONITY_HOME_RADIUS_KM : Rayon de détection domicile en km (défaut: 0.1)
  TRONITY_DAYS_LOOKBACK  : Fenêtre de récupération en jours (défaut: 30)
  TRONITY_NETWORK_LOSS_PERCENT : Correction % pertes réseau/charge (défaut: 7.0)
  TRONITY_DATE_FROM / TRONITY_DATE_TO : Période explicite (YYYY-MM-DD, bornes inclusives)
  TRONITY_EDF_COMPTE     : Nom du compte EDF pour les crédits (défaut: "EDF")

Tarifs HP/HC, plages horaires et mode d'import : configurés dans le dashboard web
  (Firestore : config/tronity).
"""

import logging
import math
import os
import sys
import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(__file__))

from tronity_client import TronityClient
from dedup import deduplicate
from firebase_db import (
    charger_config_tronity,
    charger_transactions_existantes_pour_dedoublonnage,
    patcher_edf_compte_manquant,
    sauvegarder_transactions,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

LIBELLE_RECHARGE = "Recharge domicile EV"
CATEGORIE_RECHARGE = "Recharge domicile"
TZ_PARIS = ZoneInfo("Europe/Paris")


# ── Géographie ────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance en km entre deux coordonnées GPS (formule de Haversine)."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _extract_gps(session: dict) -> tuple[float | None, float | None]:
    """Extrait lat/lng depuis les champs connus de l'API Tronity."""
    # Champ racine direct
    lat = session.get("lat") or session.get("latitude")
    lng = session.get("lng") or session.get("longitude")
    if lat is not None and lng is not None:
        return lat, lng
    # Objet location imbriqué
    loc = session.get("location") or {}
    lat = loc.get("lat") or loc.get("latitude")
    lng = loc.get("lng") or loc.get("longitude")
    return lat, lng


def is_home_charge(
    session: dict,
    home_lat: float,
    home_lon: float,
    radius_km: float,
) -> bool:
    """
    Retourne True si la session de charge s'est déroulée à moins de
    radius_km du domicile. Si aucune coordonnée GPS n'est disponible,
    assume domicile (l'API Tronity ne retourne pas toujours le GPS).
    """
    lat, lng = _extract_gps(session)
    if lat is None or lng is None:
        log.warning(
            "Session %s sans coordonnées GPS — assumée à domicile.",
            session.get("id", "?"),
        )
        return True
    try:
        dist = haversine_km(float(lat), float(lng), home_lat, home_lon)
    except (TypeError, ValueError):
        return True
    return dist <= radius_km


# ── Export brut API (CSV) ─────────────────────────────────────────────────────

def _flatten_for_csv(value: object) -> str:
    """Convertit une valeur Python en string CSV stable."""
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def export_raw_charges_to_csv(charges: list[dict], csv_path: str) -> str:
    """
    Exporte les sessions brutes Tronity dans un CSV.
    Toutes les clés rencontrées sont exportées en colonnes.
    """
    output = Path(csv_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    headers = sorted({key for charge in charges for key in charge.keys()})
    with output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for charge in charges:
            writer.writerow({
                key: _flatten_for_csv(charge.get(key))
                for key in headers
            })

    return str(output)


def _parse_yyyy_mm_dd(raw_value: str, *, env_name: str) -> datetime:
    """
    Parse une date YYYY-MM-DD (UTC minuit) depuis une variable d'environnement.
    """
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError as e:
        raise ValueError(f"{env_name} invalide ('{raw_value}') — format attendu YYYY-MM-DD.") from e


# ── Calcul HP/HC ──────────────────────────────────────────────────────────────

def _minutes_total(start_h: int, start_m: int, end_h: int, end_m: int) -> tuple[int, int]:
    """
    Convertit une plage horaire (start_h:start_m → end_h:end_m) en
    (debut_min, fin_min) en minutes depuis minuit dans une journée de 1440 min.
    Gère le cas où end < start (plage qui chevauche minuit).
    Retourne (debut_min, fin_min_mod) où fin_min_mod peut dépasser 1440.
    """
    debut = start_h * 60 + start_m
    fin = end_h * 60 + end_m
    if fin <= debut:
        fin += 1440  # la plage enjambe minuit
    return debut, fin


def _est_heure_creuse(t_paris: datetime, hc_plages: list[dict]) -> bool:
    """
    Détermine si un instant t (en heure locale Paris) tombe dans une plage HC.
    Chaque plage est un dict {start_h, start_m, end_h, end_m}.
    """
    t_min = t_paris.hour * 60 + t_paris.minute
    for plage in hc_plages:
        debut, fin = _minutes_total(
            int(plage.get("start_h", 0)),
            int(plage.get("start_m", 0)),
            int(plage.get("end_h", 0)),
            int(plage.get("end_m", 0)),
        )
        # Pour les plages qui enjambent minuit on teste aussi t_min + 1440
        if debut <= t_min < fin or debut <= (t_min + 1440) < fin:
            return True
    return False


def calculer_cout_hphc(
    kwh: float,
    start_dt: datetime,
    end_dt: datetime,
    config: dict,
) -> tuple[float, float, float]:
    """
    Calcule le coût d'une session de charge en tenant compte des plages HP/HC.
    Suppose un débit de charge constant sur la durée de la session.

    Args:
        kwh      : énergie totale chargée (kWh)
        start_dt : début de la session (datetime UTC)
        end_dt   : fin de la session (datetime UTC)
        config   : dict avec tarif_hp, tarif_hc, hc_plages

    Returns:
        (kwh_hc, kwh_hp, cout_total)
    """
    tarif_hp = float(config.get("tarif_hp", 0.2470))
    tarif_hc = float(config.get("tarif_hc", 0.1941))
    hc_plages = config.get("hc_plages", [])

    duration_s = (end_dt - start_dt).total_seconds()

    # Si pas de durée ou pas de plages HC → tout en HP
    if duration_s <= 0 or not hc_plages:
        cout = kwh * tarif_hp
        return 0.0, kwh, cout

    # Décompte des secondes HC par tranches de 1 minute
    hc_seconds = 0
    steps = max(1, int(duration_s / 60))
    step_s = duration_s / steps

    for i in range(steps):
        t_utc = start_dt + timedelta(seconds=i * step_s + step_s / 2)
        t_paris = t_utc.astimezone(TZ_PARIS)
        if _est_heure_creuse(t_paris, hc_plages):
            hc_seconds += step_s

    hc_ratio = min(hc_seconds / duration_s, 1.0)
    hp_ratio = 1.0 - hc_ratio

    kwh_hc = round(kwh * hc_ratio, 4)
    kwh_hp = round(kwh * hp_ratio, 4)
    cout = round(kwh_hc * tarif_hc + kwh_hp * tarif_hp, 4)

    return kwh_hc, kwh_hp, cout


def _compute_grid_energy_kwh(charged_energy: float, network_loss_percent: float) -> float:
    """
    Corrige l'énergie batterie Tronity en énergie réseau:
      grid = charged_energy / (1 - loss%)
    """
    denominator = 1.0 - (network_loss_percent / 100.0)
    if abs(denominator) < 1e-9:
        raise ValueError("TRONITY_NETWORK_LOSS_PERCENT trop proche de 100%, division impossible.")
    return charged_energy / denominator


# ── Normalisation session → transaction ──────────────────────────────────────

def _parse_tronity_datetime(value: object) -> datetime | None:
    """
    Parse un timestamp Tronity en datetime UTC.
    Formats acceptés :
      - ISO 8601 (ex: "2026-04-06T10:30:00Z")
      - epoch en secondes (int/float/str numérique)
      - epoch en millisecondes (int/float/str numérique)
    """
    if value is None:
        return None

    raw = str(value).strip()
    if not raw:
        return None

    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError, OSError):
        pass

    try:
        epoch = float(raw)
    except (TypeError, ValueError):
        return None

    # Tronity peut renvoyer des epochs en secondes, ms, µs voire ns selon l'endpoint.
    # On rabaisse progressivement l'échelle jusqu'à obtenir un timestamp plausible.
    for _ in range(4):
        try:
            dt = datetime.fromtimestamp(epoch, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            dt = None
        if dt is not None and 2000 <= dt.year <= 2100:
            return dt
        epoch /= 1000.0

    return None

def tronity_charge_to_dict(
    session: dict,
    config: dict,
    compte: str,
    include_raw_api_payload: bool = False,
) -> dict | None:
    """
    Convertit une session de charge Tronity en dict compatible firebase_db.
    Retourne None si la session est invalide (kWh manquant ou nul).
    """
    charged_energy_raw = session.get("charged_energy", session.get("kWh"))
    try:
        charged_energy = float(charged_energy_raw)
    except (TypeError, ValueError):
        log.warning("Session %s : charged_energy invalide (%s), ignorée.",
                    session.get("id", "?"), charged_energy_raw)
        return None

    if charged_energy <= 0:
        log.debug("Session %s : charged_energy=%.3f ≤ 0, ignorée.", session.get("id", "?"), charged_energy)
        return None

    # Timestamp de fin (ISO string ou epoch)
    ts_end = session.get("endTime")
    end_dt = _parse_tronity_datetime(ts_end)
    if end_dt is None:
        log.warning("Session %s : endTime invalide (%s), ignorée.",
                    session.get("id", "?"), ts_end)
        return None

    # Timestamp de début (ISO string ou epoch) — optionnel selon l'API
    ts_start = session.get("startTime")
    start_dt = _parse_tronity_datetime(ts_start) if ts_start is not None else None
    if start_dt is None:
        start_dt = end_dt  # fallback : prorata impossible / on utilise l'heure de fin

    network_loss_percent = float(config.get("network_loss_percent", 7.0))
    try:
        grid_energy_kwh = _compute_grid_energy_kwh(charged_energy, network_loss_percent)
    except ValueError as e:
        log.warning("Session %s : %s", session.get("id", "?"), e)
        return None

    kwh_hc, kwh_hp, cout = calculer_cout_hphc(grid_energy_kwh, start_dt, end_dt, config)
    montant = round(-cout, 2)

    tarif_hp = config.get("tarif_hp", 0.2470)
    tarif_hc = config.get("tarif_hc", 0.1941)

    if start_dt == end_dt:
        # Pas de start_time : commentaire simplifié
        commentaire = (
            f"{charged_energy:.2f} kWh batterie → {grid_energy_kwh:.2f} kWh réseau "
            f"(corr. {network_loss_percent:.2f}%) — tarif fin de charge — coût : {cout:.4f} €"
        )
    else:
        commentaire = (
            f"{charged_energy:.2f} kWh batterie → {grid_energy_kwh:.2f} kWh réseau "
            f"(corr. {network_loss_percent:.2f}%) | "
            f"{grid_energy_kwh:.2f} kWh ({kwh_hc:.2f} HC @ {tarif_hc:.4f} €/kWh "
            f"+ {kwh_hp:.2f} HP @ {tarif_hp:.4f} €/kWh) — coût : {cout:.4f} €"
        )

    # En mode domicile, une session sans GPS est importée (l'API Tronity ne
    # renvoie pas toujours la localisation) mais signalée pour vérification.
    if config.get("import_scope") == "home":
        lat, lng = _extract_gps(session)
        try:
            if lat is None or lng is None:
                raise ValueError
            float(lat)
            float(lng)
        except (TypeError, ValueError):
            commentaire += " — ⚠️ Localisation GPS absente : vérifier qu'il s'agit du domicile"

    tx = {
        "date": end_dt,
        "libelle": LIBELLE_RECHARGE,
        "compte": compte,
        "montant": montant,
        "categorie": CATEGORIE_RECHARGE,
        "commentaire": commentaire,
        "pointe": False,
        "charged_energy": round(charged_energy, 4),
        "grid_energy_kwh": round(grid_energy_kwh, 4),
        "tronity_session_id": str(session.get("id", "")).strip(),
    }
    if include_raw_api_payload:
        tx["tronity_raw"] = session
    return tx


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # ── Lecture configuration ─────────────────────────────────────────────────
    compte = os.environ.get("TRONITY_COMPTE", "")
    edf_compte = os.environ.get("TRONITY_EDF_COMPTE", "EDF")
    home_lat_raw = os.environ.get("TRONITY_HOME_LAT", "")
    home_lon_raw = os.environ.get("TRONITY_HOME_LON", "")

    missing = [
        name for name, val in [
            ("TRONITY_CLIENT_ID", os.environ.get("TRONITY_CLIENT_ID", "")),
            ("TRONITY_CLIENT_SECRET", os.environ.get("TRONITY_CLIENT_SECRET", "")),
            ("TRONITY_COMPTE", compte),
            ("TRONITY_HOME_LAT", home_lat_raw),
            ("TRONITY_HOME_LON", home_lon_raw),
        ] if not val
    ]
    if missing:
        log.error("Variables d'environnement manquantes : %s", ", ".join(missing))
        sys.exit(1)

    try:
        home_lat = float(home_lat_raw)
        home_lon = float(home_lon_raw)
    except ValueError as e:
        log.error("Valeur numérique invalide dans la configuration : %s", e)
        sys.exit(1)

    radius_km = float(os.environ.get("TRONITY_HOME_RADIUS_KM", "0.1"))
    days_lookback = int(os.environ.get("TRONITY_DAYS_LOOKBACK", "30"))
    vehicle_id_env = os.environ.get("TRONITY_VEHICLE_ID", "")

    date_from_env = os.environ.get("TRONITY_DATE_FROM", "").strip()
    date_to_env = os.environ.get("TRONITY_DATE_TO", "").strip()
    if bool(date_from_env) != bool(date_to_env):
        log.error("TRONITY_DATE_FROM et TRONITY_DATE_TO doivent être définies ensemble.")
        sys.exit(1)

    if date_from_env and date_to_env:
        try:
            date_from = _parse_yyyy_mm_dd(date_from_env, env_name="TRONITY_DATE_FROM")
            date_to_day = _parse_yyyy_mm_dd(date_to_env, env_name="TRONITY_DATE_TO")
        except ValueError as e:
            log.error("%s", e)
            sys.exit(1)
        if date_from > date_to_day:
            log.error(
                "TRONITY_DATE_FROM (%s) doit être antérieure ou égale à TRONITY_DATE_TO (%s).",
                date_from_env,
                date_to_env,
            )
            sys.exit(1)
        # Inclure toute la journée de fin (jusqu'à 23:59:59 UTC).
        now = date_to_day + timedelta(days=1) - timedelta(seconds=1)
    else:
        now = datetime.now(timezone.utc)
        date_from = now - timedelta(days=days_lookback)

    from_ts = int(date_from.timestamp())
    to_ts = int(now.timestamp())

    # ── Chargement config HP/HC depuis Firestore ──────────────────────────────
    config = charger_config_tronity()
    env_network_loss_raw = os.environ.get("TRONITY_NETWORK_LOSS_PERCENT", "").strip()
    if env_network_loss_raw:
        try:
            config["network_loss_percent"] = float(env_network_loss_raw)
        except ValueError:
            log.warning(
                "TRONITY_NETWORK_LOSS_PERCENT invalide (%s), valeur Firestore/défaut conservée.",
                env_network_loss_raw,
            )
    import_scope = str(config.get("import_scope", "home")).lower()
    if import_scope not in {"all", "home"}:
        import_scope = "home"
    config["import_scope"] = import_scope
    save_raw_api_payload = bool(config.get("save_raw_api_payload", False))
    raw_csv_path = os.environ.get("TRONITY_RAW_CSV_PATH", "tronity_raw_charges.csv")
    log.info(
        "Import Tronity | fenêtre : %s → %s | scope : %s | tarif HP : %.4f €/kWh | HC : %.4f €/kWh | "
        "corr. pertes réseau : %.2f%% | "
        "%d plage(s) HC | payload brut : %s | csv : %s | domicile : (%.5f, %.5f) rayon %.0f m",
        date_from.strftime("%Y-%m-%d"),
        now.strftime("%Y-%m-%d"),
        import_scope,
        config["tarif_hp"],
        config["tarif_hc"],
        float(config.get("network_loss_percent", 7.0)),
        len(config.get("hc_plages", [])),
        "oui" if save_raw_api_payload else "non",
        raw_csv_path,
        home_lat,
        home_lon,
        radius_km * 1000,
    )

    # ── Client Tronity ────────────────────────────────────────────────────────
    try:
        client = TronityClient()
    except ValueError as e:
        log.error("%s", e)
        sys.exit(1)

    # ── Découverte du véhicule ────────────────────────────────────────────────
    vehicle_id = vehicle_id_env
    if not vehicle_id:
        try:
            vehicles = client.get_vehicles()
        except Exception as e:
            log.error("Impossible de récupérer la liste des véhicules : %s", e)
            sys.exit(1)

        if not vehicles:
            log.error("Aucun véhicule trouvé dans le compte Tronity.")
            sys.exit(1)

        vehicle_id = vehicles[0]["id"]
        name = vehicles[0].get("display_name", vehicle_id)
        log.info("Véhicule auto-découvert : %s (%s)", name, vehicle_id)
        if len(vehicles) > 1:
            log.warning(
                "%d véhicules disponibles — le premier est utilisé. "
                "Définissez TRONITY_VEHICLE_ID pour choisir explicitement.",
                len(vehicles),
            )

    # ── Récupération des sessions de charge ───────────────────────────────────
    try:
        raw_charges = client.get_charges(vehicle_id, from_ts=from_ts, to_ts=to_ts)
    except Exception as e:
        log.warning(
            "Impossible de récupérer les charges Tronity (toutes les stratégies ont échoué) : %s. "
            "L'import Tronity est ignoré pour cette exécution.",
            e,
        )
        sys.exit(0)

    log.info("%d sessions de charge récupérées depuis l'API.", len(raw_charges))
    if save_raw_api_payload and raw_charges:
        try:
            exported = export_raw_charges_to_csv(raw_charges, raw_csv_path)
            log.info("Export CSV brut Tronity généré : %s (%d lignes).", exported, len(raw_charges))
        except Exception as e:
            log.warning("Échec export CSV brut Tronity (%s) : %s", raw_csv_path, e)

    # ── Sélection des sessions à importer ────────────────────────────────────
    if import_scope == "home":
        selected_charges = [
            s for s in raw_charges
            if is_home_charge(s, home_lat, home_lon, radius_km)
        ]
        log.info(
            "%d session(s) à domicile (rayon %.0f m) sur %d total.",
            len(selected_charges),
            radius_km * 1000,
            len(raw_charges),
        )
    else:
        selected_charges = raw_charges
        log.info(
            "%d session(s) retenue(s) sur %d total (scope=all).",
            len(selected_charges),
            len(raw_charges),
        )

    if not selected_charges:
        log.info("Aucune recharge à importer dans la fenêtre. Fin.")
        return

    # ── Normalisation avec calcul HP/HC ───────────────────────────────────────
    # Le crédit EDF compensateur n'est PAS créé ici : il est généré côté frontend
    # uniquement quand la recharge est pointée (cf. transactionRepository.ts).
    # On transporte juste le compte EDF cible sur la recharge.
    nouvelles = []
    vehicle_count = 0
    for s in selected_charges:
        vehicle_tx = tronity_charge_to_dict(
            s, config, compte, include_raw_api_payload=save_raw_api_payload
        )
        if vehicle_tx is None:
            continue
        vehicle_tx["edf_compte"] = edf_compte
        nouvelles.append(vehicle_tx)
        vehicle_count += 1
    log.info("%d recharge(s) normalisée(s).", vehicle_count)

    if not nouvelles:
        log.info("Aucune transaction valide après normalisation. Fin.")
        return

    # ── Déduplication ─────────────────────────────────────────────────────────
    # La fenêtre couvre la plage réellement importée (important quand date_from_env
    # est défini manuellement sur une période plus longue que days_lookback).
    actual_span_days = max(days_lookback, int((now - date_from).total_seconds() / 86400))
    dedup_window = actual_span_days + 30
    existantes = charger_transactions_existantes_pour_dedoublonnage(
        since_days=dedup_window
    )
    log.info(
        "Transactions existantes chargées pour dédup (%dj) : %d",
        dedup_window,
        len(existantes),
    )

    # Pré-dédup par ID session Tronity : idempotent même si les tarifs ont changé.
    existing_session_ids = {
        str(t["tronity_session_id"])
        for t in existantes
        if t.get("tronity_session_id")
    }
    session_id_dups = [tx for tx in nouvelles if tx.get("tronity_session_id") and tx["tronity_session_id"] in existing_session_ids]
    nouvelles = [tx for tx in nouvelles if not tx.get("tronity_session_id") or tx["tronity_session_id"] not in existing_session_ids]
    if session_id_dups:
        log.info("Pré-dédup session ID Tronity : %d déjà importée(s) ignorée(s).", len(session_id_dups))

    a_importer, stricts, probables = deduplicate(nouvelles, existantes)
    log.info(
        "Déduplication : %d nouvelles | %d doublons stricts | %d doublons probables",
        len(a_importer),
        len(stricts),
        len(probables),
    )

    # ── Sauvegarde Firebase ───────────────────────────────────────────────────
    if a_importer:
        saved = sauvegarder_transactions(a_importer, source="tronity")
        log.info("✓ %d transaction(s) sauvegardée(s) dans Firebase.", saved)
    else:
        log.info("Aucune nouvelle transaction à sauvegarder.")

    # Patch rétroactif : les recharges importées avant l'ajout du champ
    # edf_compte (commit cc135b0) ne peuvent pas être mises à jour par la
    # déduplication normale. On les corrige ici à chaque import.
    patcher_edf_compte_manquant(edf_compte)


if __name__ == "__main__":
    main()
