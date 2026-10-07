#!/usr/bin/env python3
"""
property_valuation.py — Estimation mensuelle des biens immobiliers (open data)
=============================================================================

Pour chaque document `placements` de type `immobilier`, calcule une estimation
à partir de trois sources ouvertes, gratuites et sans clé d'API :

  - IGN Géoplateforme : adresse → code INSEE (mis en cache dans `bien.codeInsee`) ;
  - Cerema DV3F       : prix médian au m² par commune, avec quartiles et nombre de ventes ;
                        quand il est indisponible, repli sur les ventes DVF (Etalab) ;
  - ADEME (DPE)       : étiquette énergie, année et étage du logement quand l'utilisateur
                        ne les a pas saisis (jamais écrits dans `bien`) ;
  - INSEE (BDM)       : indice des prix des logements anciens, pour ramener le
                        millésime DVF à la date du jour.

La logique pure (série DV3F, ajustements heuristiques, réindexation) vit dans
property_estimator.py. Ce module porte les appels HTTP, l'orchestration et les
écritures Firestore.

Règles d'écriture :
  - `estimation` est toujours remplacée en entier (statut, date, détail) ;
  - `montant` n'est écrit que si l'estimation réussit ET que le bien est en mode
    `estime` : un échec ne doit jamais effacer la valeur précédente ;
  - exception : un `montant` à 0 reçoit le coût d'achat (plancher) — il remplace
    un zéro, jamais une valeur saisie.

Le snapshot quotidien (`take_patrimoine_snapshot`) historise `montant` : aucune
collection d'historique dédiée.

Usage :
    python src/property_valuation.py --dry-run
    python src/property_valuation.py [--placement-id <id>]
"""

import argparse
import csv
import io
import logging
import re
import sys
import time
from datetime import date

import requests
from google.cloud.firestore_v1.base_query import FieldFilter

from firebase_db import _get_db
from property_estimator import (
    calculer_ajustements,
    choisir_dpe,
    commune_parente,
    comparables_locaux,
    construire_resultat,
    cout_achat,
    departement,
    detail_reindexation,
    lignes_depuis_dvf,
    zone_supportee,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger(__name__)

GEOCODE_URL = "https://data.geopf.fr/geocodage/search"
CEREMA_URL = "https://apidf-preprod.cerema.fr/indicateurs/dv3f/prix/annuel/"
DVF_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv"
ADEME_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines"
INSEE_URL = "https://api.insee.fr/series/BDM/V1/data/SERIES_BDM/{idbank}"

# Indice des prix des logements anciens : appartements, maisons, ensemble.
INSEE_IDBANK = {"appartement": "010567056", "maison": "010567060"}
INSEE_IDBANK_ENSEMBLE = "010567058"

HTTP_TIMEOUT_S = 15
HTTP_ATTEMPTS = 2
HTTP_BACKOFF_S = 2.0
SCORE_GEOCODAGE_MIN = 0.4
CEREMA_MAX_PAGES = 5
DVF_ANNEES = 3
ADEME_RAYON_M = 15
ADEME_CHAMPS = (
    "etiquette_dpe,surface_habitable_logement,annee_construction,"
    "numero_etage_appartement,type_batiment,date_fin_validite_dpe"
)

OBS_RE = re.compile(r'TIME_PERIOD="(\d{4})-Q([1-4])"\s+OBS_VALUE="([0-9.]+)"')


class ProviderError(Exception):
    """Source indisponible (transport, 5xx, 429) — à distinguer d'une absence de données."""


def _get(url: str, params: dict | None = None) -> requests.Response | None:
    """GET avec timeout et nouvelle tentative. None sur 404 ; ProviderError si la source est HS."""
    last_error: Exception | None = None
    for attempt in range(1, HTTP_ATTEMPTS + 1):
        try:
            resp = requests.get(url, params=params, timeout=HTTP_TIMEOUT_S)
            if resp.status_code == 404:
                return None
            if resp.status_code == 429 or resp.status_code >= 500:
                raise ProviderError(f"HTTP {resp.status_code} sur {url}")
            resp.raise_for_status()
            return resp
        except (requests.RequestException, ProviderError) as e:
            last_error = e
            if attempt < HTTP_ATTEMPTS:
                time.sleep(HTTP_BACKOFF_S * attempt)
    raise ProviderError(str(last_error)) from last_error


def geocoder(bien: dict) -> dict | None:
    """Géocode l'adresse via l'IGN. None si aucun résultat assez fiable (score < 0,4)."""
    q = " ".join(
        str(bien.get(champ) or "") for champ in ("adresse", "codePostal", "ville")
    ).strip()
    resp = _get(GEOCODE_URL, {"q": q, "limit": 1, "index": "address"})
    features = (resp.json().get("features") if resp else None) or []
    if not features:
        return None
    props = features[0].get("properties", {})
    score = float(props.get("score") or 0)
    code = props.get("citycode")
    if not code or score < SCORE_GEOCODAGE_MIN:
        return None
    lon, lat = (features[0].get("geometry", {}).get("coordinates") or [None, None])[:2]
    return {"codeInsee": code, "lat": lat, "lon": lon, "scoreGeocodage": round(score, 3)}


def lignes_cerema(code: str, echelle: str) -> list[dict]:
    """Indicateurs annuels DV3F d'une commune ou d'un département, du plus ancien au plus récent."""
    url: str | None = CEREMA_URL
    params: dict | None = {"echelle": echelle, "code": code}
    lignes: list[dict] = []
    for _ in range(CEREMA_MAX_PAGES):
        resp = _get(url, params)
        if resp is None:
            break
        data = resp.json()
        lignes.extend(data.get("results") or [])
        url, params = data.get("next"), None
        if not url:
            break
    return sorted(lignes, key=lambda ligne: str(ligne.get("annee")))


def lignes_pour_bien(code_insee: str) -> tuple[list[dict], str]:
    """Lignes Cerema et échelle retenue : commune, commune parente (arrondissements), département."""
    lignes = lignes_cerema(code_insee, "communes")
    parente = commune_parente(code_insee)
    if not lignes and parente:
        lignes = lignes_cerema(parente, "communes")
    if lignes:
        return lignes, "communes"
    return lignes_cerema(departement(code_insee), "departements"), "departements"


def _csv_dvf(code: str, annee: int) -> list[dict]:
    """Ventes DVF d'une commune pour un millésime ; vide si le fichier n'existe pas (404)."""
    resp = _get(f"{DVF_URL}/{annee}/communes/{departement(code)}/{code}.csv")
    return list(csv.DictReader(io.StringIO(resp.text))) if resp else []


def dvf_par_annee(code_insee: str, aujourd_hui: date) -> dict[str, list[dict]]:
    """Ventes DVF brutes de la commune (ou de sa commune parente) pour les DVF_ANNEES derniers millésimes."""
    for code in filter(None, [code_insee, commune_parente(code_insee)]):
        par_annee = {
            str(annee): _csv_dvf(code, annee)
            for annee in range(aujourd_hui.year - 1, aujourd_hui.year - 1 - DVF_ANNEES, -1)
        }
        if any(par_annee.values()):
            return par_annee
    return {}


def lignes_dvf(code_insee: str, aujourd_hui: date) -> list[dict]:
    """Repli du Cerema : indicateurs recalculés depuis les ventes DVF des DVF_ANNEES derniers millésimes."""
    return lignes_depuis_dvf(dvf_par_annee(code_insee, aujourd_hui))


def dpe_ademe(lat: float, lon: float) -> list[dict]:
    """Diagnostics DPE géolocalisés à moins de ADEME_RAYON_M mètres de l'adresse."""
    resp = _get(
        ADEME_URL,
        {"geo_distance": f"{lon},{lat},{ADEME_RAYON_M}", "size": 100, "select": ADEME_CHAMPS},
    )
    return (resp.json().get("results") if resp else None) or []


def serie_insee(idbank: str) -> dict[str, float]:
    """Indice INSEE par trimestre, clé `AAAAQn`. Le XML est lu par regex (aucune dépendance)."""
    resp = _get(INSEE_URL.format(idbank=idbank))
    if resp is None:
        return {}
    return {f"{y}Q{q}": float(v) for y, q, v in OBS_RE.findall(resp.text)}


def reindexation_pour_millesime(nature: str, millesime: str, aujourd_hui: date) -> dict | None:
    """Détail de la réindexation INSEE (indices, trimestres, ratio), ou None si l'indice est indisponible."""
    for idbank in (INSEE_IDBANK.get(nature), INSEE_IDBANK_ENSEMBLE):
        if not idbank:
            continue
        try:
            detail = detail_reindexation(serie_insee(idbank), millesime, aujourd_hui)
        except ProviderError as e:
            log.warning("Indice INSEE %s indisponible : %s", idbank, e)
            continue
        if detail is not None:
            return detail
    return None


def ratio_pour_millesime(nature: str, millesime: str, aujourd_hui: date) -> float | None:
    """Ratio de réindexation INSEE, ou None si l'indice est indisponible (estimation sans réindexation)."""
    detail = reindexation_pour_millesime(nature, millesime, aujourd_hui)
    return detail["ratio"] if detail else None


def _statut(statut: str, aujourd_hui: date) -> dict:
    return {"statut": statut, "date": aujourd_hui.isoformat()}


def _bien_complet(bien: dict) -> bool:
    surface = bien.get("surface")
    return (
        isinstance(surface, (int, float))
        and surface > 0
        and bien.get("nature") in ("appartement", "maison")
        and bool(bien.get("adresse") or bien.get("codeInsee"))
    )


def estimer_bien(doc: dict, aujourd_hui: date | None = None) -> tuple[dict, dict]:
    """Estime un bien. Retourne (estimation, champs de géocodage à mettre en cache dans `bien`)."""
    aujourd_hui = aujourd_hui or date.today()
    bien = doc.get("bien") or {}
    cache: dict = {}

    if not _bien_complet(bien):
        return _statut("INCOMPLETE_DATA", aujourd_hui), cache

    try:
        code_insee = bien.get("codeInsee")
        if not code_insee:
            geo = geocoder(bien)
            if geo is None:
                return _statut("GEOCODING_FAILED", aujourd_hui), cache
            cache = geo
            code_insee = geo["codeInsee"]

        if not zone_supportee(code_insee):
            return _statut("UNSUPPORTED_AREA", aujourd_hui), cache

        lat = cache.get("lat") or bien.get("lat")
        lon = cache.get("lon") or bien.get("lon")
        resultat, source, ventes, dvf_indisponible = None, None, None, False

        if lat and lon:
            try:
                ventes = dvf_par_annee(code_insee, aujourd_hui)
                ratios = {
                    annee: ratio_pour_millesime(bien["nature"], annee, aujourd_hui) or 1.0
                    for annee in ventes
                }
                resultat = comparables_locaux(ventes, bien, lat, lon, ratios)
                source = "dvf-voisinage"
            except ProviderError as e:
                log.warning("DVF indisponible pour les comparables locaux : %s", e)
                dvf_indisponible = True

        if resultat is None:
            try:
                lignes, echelle = lignes_pour_bien(code_insee)
                source = "cerema"
            except ProviderError as e:
                log.warning("Cerema indisponible (%s), repli sur DVF", e)
                if dvf_indisponible:
                    raise
                ventes = ventes if ventes is not None else dvf_par_annee(code_insee, aujourd_hui)
                lignes, echelle, source = lignes_depuis_dvf(ventes), "communes", "dvf"
            resultat = construire_resultat(lignes, bien, echelle)
            if resultat is None:
                return _statut("NO_COMPARABLE_DATA", aujourd_hui), cache

        detecte = None
        if lat and lon and not (bien.get("dpe") and bien.get("anneeConstruction")):
            try:
                detecte = choisir_dpe(dpe_ademe(lat, lon), bien, aujourd_hui)
            except ProviderError as e:
                log.warning("DPE ADEME indisponible : %s", e)
            detecte = {c: v for c, v in (detecte or {}).items() if bien.get(c) in (None, "")} or None

        ajustements = calculer_ajustements(bien, resultat["valeur"], resultat["prixM2"], detecte)
        valeur = ajustements.appliquer(resultat["valeur"])
        basse = ajustements.appliquer(resultat["basse"])
        haute = ajustements.appliquer(resultat["haute"])

        if source == "dvf-voisinage":  # chaque vente est déjà réindexée à son millésime
            reindexation = {"integree": True, "ratios": resultat["ratios"]}
            ratio = None
        else:
            reindexation = reindexation_pour_millesime(bien["nature"], resultat["millesime"], aujourd_hui)
            ratio = reindexation["ratio"] if reindexation else None
            if ratio is not None:
                valeur, basse, haute = valeur * ratio, basse * ratio, haute * ratio
    except ProviderError as e:
        log.warning("Source indisponible : %s", e)
        return _statut("PROVIDER_UNAVAILABLE", aujourd_hui), cache

    reference = {
        "serie": resultat["serie"],
        "prixM2": round(resultat["prixM2"], 2),
        "q25M2": round(resultat["q25M2"], 2),
        "q75M2": round(resultat["q75M2"], 2),
        "millesime": resultat["millesime"],
        "echantillon": resultat["echantillon"],
        "echelle": resultat["echelle"],
        "source": source,
        **({"rayon": resultat["rayon"]} if "rayon" in resultat else {}),
    }
    justification = {
        "reference": reference,
        "comparables": resultat.get("comparables"),
        "reindexation": reindexation,
        "multiplicateur": {
            "somme": round(ajustements.somme, 4),
            "applique": round(ajustements.multiplicateur, 4),
            "borne": ajustements.borne,
        },
    }
    estimation = {
        **_statut("OK", aujourd_hui),
        "source": source,
        "valeur": round(valeur),
        "basse": round(basse),
        "haute": round(haute),
        "prixM2": round(resultat["prixM2"], 2),
        "echantillon": resultat["echantillon"],
        "confiance": resultat["confiance"],
        "millesime": resultat["millesime"],
        "echelle": resultat["echelle"],
        "multiplicateur": round(ajustements.multiplicateur, 4),
        "ratioReindexation": round(ratio, 4) if ratio is not None else None,
        "ajustements": ajustements.detail,
        "justification": {k: v for k, v in justification.items() if v is not None},
    }
    if "rayon" in resultat:
        estimation["rayon"] = resultat["rayon"]
    if detecte:
        estimation["dpeDetecte"] = {**detecte, "source": "ademe"}
    return estimation, cache


def traiter_placement(ref, doc: dict, dry_run: bool, aujourd_hui: date | None = None) -> dict:
    """Estime un bien et écrit le résultat. Retourne l'estimation (même en dry-run)."""
    estimation, cache = estimer_bien(doc, aujourd_hui)
    estimation = {k: v for k, v in estimation.items() if v is not None}

    update: dict = {"estimation": estimation}
    update.update({f"bien.{champ}": valeur for champ, valeur in cache.items()})

    montant = float(doc.get("montant") or 0)
    if estimation["statut"] == "OK" and doc.get("modeValorisation") == "estime":
        update["montant"] = estimation["valeur"]
    elif estimation["statut"] != "OK" and montant == 0 and cout_achat(doc.get("bien") or {}) > 0:
        update["montant"] = cout_achat(doc["bien"])

    log.info(
        "%s : %s%s",
        doc.get("nom") or ref.id,
        estimation["statut"],
        f" → {update['montant']:.0f} €" if "montant" in update else " (montant inchangé)",
    )
    if not dry_run:
        ref.update(update)
    return estimation


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estime les biens immobiliers (open data).")
    parser.add_argument("--placement-id", help="Ne traiter que ce placement.")
    parser.add_argument("--dry-run", action="store_true", help="Calcule sans écrire dans Firestore.")
    args = parser.parse_args(argv)

    db = _get_db()
    collection = db.collection("placements")
    if args.placement_id:
        snap = collection.document(args.placement_id).get()
        snaps = [snap] if snap.exists and (snap.to_dict() or {}).get("type") == "immobilier" else []
    else:
        snaps = list(collection.where(filter=FieldFilter("type", "==", "immobilier")).stream())

    if not snaps:
        log.info("Aucun bien immobilier à estimer.")
        return 0

    erreurs = 0
    for snap in snaps:
        try:
            traiter_placement(snap.reference, snap.to_dict() or {}, args.dry_run)
        except Exception:
            erreurs += 1
            log.exception("Échec de l'estimation du placement %s", snap.id)
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
