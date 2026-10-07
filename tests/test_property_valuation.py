"""Tests de src/property_valuation.py : appels HTTP simulés (fixtures), Firestore mocké.

Aucune requête réseau réelle : `requests.get` et `_get_db` sont remplacés.
"""
import csv
import io
import json
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import requests

import property_valuation as pv

FIXTURES = Path(__file__).parent / "fixtures" / "property"
AUJOURD_HUI = date(2026, 10, 7)


def _fixture(name):
    return (FIXTURES / name).read_text(encoding="utf-8")


CEREMA = json.loads(_fixture("cerema_communes_44109.json"))
IGN = json.loads(_fixture("ign_geocode_nantes.json"))
INSEE_XML = _fixture("insee_logements_anciens.xml")


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")


class Reseau:
    """Routeur d'URL pour `requests.get` : chaque source a sa réponse (ou sa panne)."""

    def __init__(self, cerema=None, ign=None, insee=None, dvf=None, ademe=None):
        self.cerema = cerema or (lambda params: FakeResponse(payload=CEREMA))
        self.ign = ign or (lambda params: FakeResponse(payload=IGN))
        self.insee = insee or (lambda params: FakeResponse(text=INSEE_XML))
        self.dvf = dvf or (lambda url: FakeResponse(status_code=503))
        self.ademe = ademe or (lambda params: FakeResponse(payload={"results": []}))
        self.appels = []

    def __call__(self, url, params=None, timeout=None):
        self.appels.append((url, params))
        if url.startswith(pv.GEOCODE_URL):
            return self.ign(params)
        if url.startswith(pv.CEREMA_URL):
            return self.cerema(params)
        if url.startswith(pv.ADEME_URL):
            return self.ademe(params)
        if url.startswith(pv.DVF_URL):
            return self.dvf(url)
        if "api.insee.fr" in url:
            return self.insee(params)
        raise AssertionError(f"URL inattendue : {url}")

    def appels_vers(self, prefixe):
        return [a for a in self.appels if a[0].startswith(prefixe)]


@pytest.fixture
def reseau(monkeypatch):
    r = Reseau()
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    return r


def _panne(params):
    return FakeResponse(status_code=503, text="Service Unavailable")


def _csv_dvf(prix_m2, nb=20, surface=100, lat=None, lon=None, metres_pas=0.0):
    """CSV DVF géolocalisé : `nb` ventes de maisons à `prix_m2` €/m² (GPS si `lat`/`lon`)."""
    champs = ["id_mutation", "date_mutation", "nature_mutation", "valeur_fonciere", "type_local",
              "surface_reelle_bati", "nombre_pieces_principales", "latitude", "longitude"]
    sortie = io.StringIO()
    ecrivain = csv.DictWriter(sortie, fieldnames=champs)
    ecrivain.writeheader()
    for i in range(nb):
        ecrivain.writerow({"id_mutation": f"m{i}", "date_mutation": "2025-03-01",
                           "nature_mutation": "Vente", "valeur_fonciere": prix_m2 * surface,
                           "type_local": "Maison", "surface_reelle_bati": surface,
                           "nombre_pieces_principales": 5,
                           "latitude": "" if lat is None else lat + i * metres_pas / 111195,
                           "longitude": "" if lon is None else lon})
    return sortie.getvalue()


def _maison(**overrides):
    bien = {
        "adresse": "10 rue de la Paix",
        "codePostal": "44000",
        "ville": "Nantes",
        "nature": "maison",
        "surface": 100,
        "pieces": 5,
        "prixAchat": 300000,
        "fraisNotaire": 20000,
    }
    bien.update(overrides)
    return {
        "nom": "Maison",
        "type": "immobilier",
        "montant": 250000,
        "modeValorisation": "estime",
        "bien": bien,
    }


# --- estimer_bien -------------------------------------------------------------


def test_estimation_ok_de_bout_en_bout(reseau):
    estimation, cache = pv.estimer_bien(_maison(), AUJOURD_HUI)

    assert estimation["statut"] == "OK"
    assert estimation["source"] == "cerema"
    assert estimation["date"] == "2026-10-07"
    assert estimation["prixM2"] == 3300
    assert estimation["millesime"] == "2024"
    assert estimation["echelle"] == "communes"
    assert estimation["echantillon"] == 170
    assert estimation["confiance"] == "haute"
    assert estimation["multiplicateur"] == 1.0
    assert estimation["ajustements"] == []
    # Millésime 2024 → juillet 2024 (T3 = 120,0) ; dernière valeur connue = T2 2026 = 125,1.
    assert estimation["ratioReindexation"] == pytest.approx(125.1 / 120.0, abs=1e-4)
    assert estimation["valeur"] == round(330000 * 125.1 / 120.0)
    assert estimation["basse"] == round(290000 * 125.1 / 120.0)
    assert estimation["haute"] == round(380000 * 125.1 / 120.0)
    assert estimation["basse"] < estimation["valeur"] < estimation["haute"]
    assert cache == {
        "codeInsee": "44109",
        "lat": 47.218371,
        "lon": -1.553621,
        "scoreGeocodage": 0.91,
    }


def test_geocodage_en_cache_n_appelle_pas_l_ign(reseau):
    doc = _maison(codeInsee="44109")
    estimation, cache = pv.estimer_bien(doc, AUJOURD_HUI)
    assert estimation["statut"] == "OK"
    assert cache == {}
    assert reseau.appels_vers(pv.GEOCODE_URL) == []
    assert reseau.appels_vers(pv.CEREMA_URL)[0][1] == {"echelle": "communes", "code": "44109"}


def test_ajustements_appliques_a_la_valeur_et_a_la_fourchette(reseau):
    doc = _maison(codeInsee="44109", dpe="G", garages=1)
    estimation, _ = pv.estimer_bien(doc, AUJOURD_HUI)
    ratio = 125.1 / 120.0
    assert estimation["multiplicateur"] == 0.9
    codes = {a["code"] for a in estimation["ajustements"]}
    assert codes == {"ENERGY_G", "GARAGE"}
    attendu = (330000 * 0.9 + 12 * 3300) * ratio
    assert estimation["valeur"] == round(attendu)
    assert estimation["basse"] == round((290000 * 0.9 + 12 * 3300) * ratio)
    assert estimation["haute"] == round((380000 * 0.9 + 12 * 3300) * ratio)


def test_indice_insee_indisponible_estime_sans_reindexation(monkeypatch):
    r = Reseau(insee=_panne)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "OK"
    assert estimation["valeur"] == 330000
    assert "ratioReindexation" in estimation and estimation["ratioReindexation"] is None


def test_cerema_503_donne_provider_unavailable(monkeypatch):
    r = Reseau(cerema=_panne)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation == {"statut": "PROVIDER_UNAVAILABLE", "date": "2026-10-07"}
    assert len(r.appels_vers(pv.CEREMA_URL)) == pv.HTTP_ATTEMPTS


IGN_LAT, IGN_LON = IGN["features"][0]["geometry"]["coordinates"][1], IGN["features"][0]["geometry"]["coordinates"][0]


def _dvf_voisinage(prix_m2=4000, nb=20):
    def dvf(url):
        if "/2025/" in url:
            return FakeResponse(text=_csv_dvf(prix_m2, nb, lat=IGN_LAT, lon=IGN_LON, metres_pas=5))
        return FakeResponse(status_code=404)

    return dvf


def _lancer(monkeypatch, doc, **routes):
    r = Reseau(**routes)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, cache = pv.estimer_bien(doc, AUJOURD_HUI)
    return estimation, cache, r


def test_comparables_locaux_preferes_a_la_mediane_communale(monkeypatch):
    estimation, _, r = _lancer(monkeypatch, _maison(), dvf=_dvf_voisinage(4000))
    assert estimation["statut"] == "OK"
    assert estimation["source"] == "dvf-voisinage"
    assert estimation["echelle"] == "voisinage"
    assert estimation["rayon"] == 300
    ratio_2025 = 125.1 / 127.5  # fixture INSEE : T3 2025 → T2 2026, déjà appliqué aux ventes
    assert estimation["prixM2"] == pytest.approx(4000 * ratio_2025, abs=0.01)
    assert estimation["valeur"] == round(4000 * ratio_2025 * 100)  # pas de second ratio
    assert estimation["confiance"] == "moyenne"
    assert "ratioReindexation" in estimation and estimation["ratioReindexation"] is None
    assert r.appels_vers(pv.CEREMA_URL) == []


def test_comparables_reindexes_par_millesime(monkeypatch):
    estimation, _, _ = _lancer(monkeypatch, _maison(), dvf=_dvf_voisinage(4000))
    just = estimation["justification"]
    assert just["reindexation"]["integree"] is True
    assert list(just["reindexation"]["ratios"]) == ["2025"]
    assert just["reindexation"]["ratios"]["2025"] == pytest.approx(125.1 / 127.5)


def test_trop_peu_de_comparables_retombe_sur_le_cerema(monkeypatch):
    estimation, _, r = _lancer(monkeypatch, _maison(), dvf=_dvf_voisinage(4000, nb=5))
    assert estimation["source"] == "cerema" and estimation["echelle"] == "communes"
    assert len(r.appels_vers(pv.CEREMA_URL)) == 1


def test_comparables_sans_coordonnees_connues_ne_sont_pas_tentes(monkeypatch):
    _, _, r = _lancer(monkeypatch, _maison(codeInsee="44109"), dvf=_dvf_voisinage())
    assert r.appels_vers(pv.DVF_URL) == []


def test_dvf_en_panne_avec_coordonnees_retombe_sur_le_cerema(monkeypatch):
    estimation, _, _ = _lancer(monkeypatch, _maison())
    assert estimation["statut"] == "OK" and estimation["source"] == "cerema"


def test_cerema_et_dvf_en_panne_avec_coordonnees(monkeypatch):
    estimation, _, r = _lancer(monkeypatch, _maison(), cerema=_panne)
    assert estimation["statut"] == "PROVIDER_UNAVAILABLE"
    assert len(r.appels_vers(pv.DVF_URL)) == pv.HTTP_ATTEMPTS  # DVF n'est pas retenté


def test_justification_cerema_complete(reseau):
    estimation, _ = pv.estimer_bien(_maison(dpe="G"), AUJOURD_HUI)
    just = estimation["justification"]
    assert just["reference"] == {
        "serie": "cod111", "prixM2": 3300, "q25M2": 2900, "q75M2": 3800,
        "millesime": "2024", "echantillon": 170, "echelle": "communes", "source": "cerema",
    }
    assert "comparables" not in just
    assert just["reindexation"]["trimestreDepart"] == "2024Q3"
    assert just["reindexation"]["ratio"] == pytest.approx(125.1 / 120.0)
    assert just["multiplicateur"] == {"somme": -0.1, "applique": 0.9, "borne": None}


def test_justification_voisinage_liste_cinq_comparables(monkeypatch):
    estimation, _, _ = _lancer(monkeypatch, _maison(), dvf=_dvf_voisinage())
    comparables = estimation["justification"]["comparables"]
    assert len(comparables) == 5
    assert [c["distanceM"] for c in comparables] == sorted(c["distanceM"] for c in comparables)
    assert estimation["justification"]["reference"]["rayon"] == 300


def _dpe_maison(etiquette="G", **extra):
    ligne = {"etiquette_dpe": etiquette, "surface_habitable_logement": 100.0,
             "type_batiment": "maison", "date_fin_validite_dpe": "2034-01-01"}
    ligne.update(extra)
    return ligne


def test_dpe_detecte_applique_et_trace(monkeypatch):
    ademe = lambda params: FakeResponse(payload={"results": [_dpe_maison("G", annee_construction=1960)]})
    estimation, _, r = _lancer(monkeypatch, _maison(), ademe=ademe)
    assert estimation["dpeDetecte"] == {"dpe": "G", "anneeConstruction": 1960, "source": "ademe"}
    energie = next(a for a in estimation["ajustements"] if a["code"] == "ENERGY_G")
    assert energie["origine"] == "ademe" and energie["valeurBien"] == "G"
    assert estimation["multiplicateur"] == 0.9
    appel = r.appels_vers(pv.ADEME_URL)[0][1]
    assert appel["geo_distance"].endswith(f",{pv.ADEME_RAYON_M}")


def test_dpe_saisi_prime_et_ademe_n_est_pas_appele(monkeypatch):
    doc = _maison(dpe="B", anneeConstruction=1990)
    estimation, _, r = _lancer(monkeypatch, doc, ademe=lambda p: FakeResponse(payload={"results": [_dpe_maison("G")]}))
    assert "dpeDetecte" not in estimation
    assert r.appels_vers(pv.ADEME_URL) == []
    assert {a["code"] for a in estimation["ajustements"]} == {"ENERGY_B"}


def test_dpe_detecte_ne_remplace_pas_une_saisie_partielle(monkeypatch):
    ademe = lambda p: FakeResponse(payload={"results": [_dpe_maison("G", annee_construction=1960)]})
    estimation, _, _ = _lancer(monkeypatch, _maison(dpe="B"), ademe=ademe)
    assert estimation["dpeDetecte"] == {"anneeConstruction": 1960, "source": "ademe"}
    assert {a["code"] for a in estimation["ajustements"]} == {"ENERGY_B"}


def test_ademe_en_panne_n_empeche_pas_l_estimation(monkeypatch):
    estimation, _, _ = _lancer(monkeypatch, _maison(), ademe=_panne)
    assert estimation["statut"] == "OK" and "dpeDetecte" not in estimation


def test_cerema_503_repli_sur_dvf(monkeypatch):
    def dvf(url):
        if "/2025/" in url:
            return FakeResponse(text=_csv_dvf(3000))
        return FakeResponse(status_code=404)

    r = Reseau(cerema=_panne, dvf=dvf)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "OK"
    assert estimation["source"] == "dvf"
    assert estimation["millesime"] == "2025"
    assert estimation["prixM2"] == 3000
    assert estimation["echantillon"] == 20
    assert estimation["echelle"] == "communes"
    assert [a[0] for a in r.appels_vers(pv.DVF_URL)] == [
        f"{pv.DVF_URL}/{annee}/communes/44/44109.csv" for annee in (2025, 2024, 2023)
    ]


def test_cerema_et_dvf_en_panne_donnent_provider_unavailable(monkeypatch):
    r = Reseau(cerema=_panne)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation == {"statut": "PROVIDER_UNAVAILABLE", "date": "2026-10-07"}


def test_cerema_ok_n_appelle_pas_dvf(reseau):
    pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert reseau.appels_vers(pv.DVF_URL) == []


def test_dvf_commune_sans_ventes_donne_no_comparable_data(monkeypatch):
    r = Reseau(cerema=_panne, dvf=lambda url: FakeResponse(status_code=404))
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "NO_COMPARABLE_DATA"


def test_dvf_arrondissement_essaie_la_commune_parente(monkeypatch):
    def dvf(url):
        if "/75056.csv" in url:
            return FakeResponse(text=_csv_dvf(10000))
        return FakeResponse(status_code=404)

    r = Reseau(cerema=_panne, dvf=dvf)
    monkeypatch.setattr(pv.requests, "get", r)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="75102"), AUJOURD_HUI)
    assert estimation["statut"] == "OK" and estimation["source"] == "dvf"


def test_erreur_de_transport_donne_provider_unavailable(monkeypatch):
    def boom(url, params=None, timeout=None):
        raise requests.ConnectionError("réseau coupé")

    monkeypatch.setattr(pv.requests, "get", boom)
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    estimation, _ = pv.estimer_bien(_maison(), AUJOURD_HUI)
    assert estimation["statut"] == "PROVIDER_UNAVAILABLE"


@pytest.mark.parametrize(
    "bien",
    [{"surface": 0}, {"surface": None}, {"adresse": ""}, {"nature": "garage"}],
)
def test_donnees_incompletes(reseau, bien):
    estimation, _ = pv.estimer_bien(_maison(**bien), AUJOURD_HUI)
    assert estimation["statut"] == "INCOMPLETE_DATA"
    assert reseau.appels == []


def test_geocodage_score_trop_faible(monkeypatch, reseau):
    faible = json.loads(json.dumps(IGN))
    faible["features"][0]["properties"]["score"] = 0.39
    reseau.ign = lambda params: FakeResponse(payload=faible)
    estimation, cache = pv.estimer_bien(_maison(), AUJOURD_HUI)
    assert estimation["statut"] == "GEOCODING_FAILED"
    assert cache == {}


def test_geocodage_sans_resultat(reseau):
    reseau.ign = lambda params: FakeResponse(payload={"features": []})
    estimation, _ = pv.estimer_bien(_maison(), AUJOURD_HUI)
    assert estimation["statut"] == "GEOCODING_FAILED"


def test_alsace_moselle_non_couverte(reseau):
    estimation, _ = pv.estimer_bien(_maison(codeInsee="67482"), AUJOURD_HUI)
    assert estimation["statut"] == "UNSUPPORTED_AREA"
    assert reseau.appels_vers(pv.CEREMA_URL) == []


def test_aucune_donnee_cerema_donne_no_comparable_data(reseau):
    reseau.cerema = lambda params: FakeResponse(payload={"results": []})
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "NO_COMPARABLE_DATA"
    # commune puis repli département
    assert [p["echelle"] for _, p in reseau.appels_vers(pv.CEREMA_URL)] == [
        "communes",
        "departements",
    ]


def test_repli_departement_confiance_faible(reseau):
    def cerema(params):
        if params["echelle"] == "communes":
            return FakeResponse(payload={"results": []})
        return FakeResponse(payload=CEREMA)

    reseau.cerema = cerema
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "OK"
    assert estimation["echelle"] == "departements"
    assert estimation["confiance"] == "faible"
    assert reseau.appels_vers(pv.CEREMA_URL)[-1][1] == {"echelle": "departements", "code": "44"}


def test_arrondissement_de_paris_essaie_la_commune_parente(reseau):
    def cerema(params):
        if params["code"] == "75056":
            return FakeResponse(payload=CEREMA)
        return FakeResponse(payload={"results": []})

    reseau.cerema = cerema
    estimation, _ = pv.estimer_bien(_maison(codeInsee="75102"), AUJOURD_HUI)
    assert estimation["statut"] == "OK"
    assert estimation["echelle"] == "communes"
    assert [p["code"] for _, p in reseau.appels_vers(pv.CEREMA_URL)] == ["75102", "75056"]


def test_cerema_404_est_une_absence_de_donnees(reseau):
    reseau.cerema = lambda params: FakeResponse(status_code=404)
    estimation, _ = pv.estimer_bien(_maison(codeInsee="44109"), AUJOURD_HUI)
    assert estimation["statut"] == "NO_COMPARABLE_DATA"


def test_pagination_cerema_suivie_et_triee(reseau):
    page_suivante = pv.CEREMA_URL + "?page=2"
    page1 = {"results": [CEREMA["results"][1], CEREMA["results"][0]], "next": page_suivante}
    page2 = {"results": [CEREMA["results"][2]], "next": None}
    # La page suivante est appelée par son URL complète, sans paramètres.
    reseau.cerema = lambda params: FakeResponse(payload=page1 if params else page2)

    lignes = pv.lignes_cerema("44109", "communes")

    assert [ligne["annee"] for ligne in lignes] == ["2022", "2023", "2024"]
    assert len(reseau.appels_vers(pv.CEREMA_URL)) == 2


# --- traiter_placement : règles d'écriture ------------------------------------


def _ref():
    ref = MagicMock()
    ref.id = "p1"
    return ref


def test_mode_estime_ecrit_le_montant(reseau):
    ref = _ref()
    est = pv.traiter_placement(ref, _maison(), dry_run=False, aujourd_hui=AUJOURD_HUI)
    (update,), _ = ref.update.call_args
    assert update["montant"] == est["valeur"]
    assert update["estimation"]["statut"] == "OK"
    assert update["bien.codeInsee"] == "44109"
    assert update["bien.lat"] == 47.218371


def test_mode_manuel_ne_modifie_pas_le_montant(reseau):
    doc = _maison()
    doc["modeValorisation"] = "manuel"
    ref = _ref()
    est = pv.traiter_placement(ref, doc, dry_run=False, aujourd_hui=AUJOURD_HUI)
    (update,), _ = ref.update.call_args
    assert est["statut"] == "OK"
    assert "montant" not in update
    assert "estimation" in update


def test_provider_unavailable_laisse_le_montant_inchange(monkeypatch):
    monkeypatch.setattr(pv.requests, "get", Reseau(cerema=_panne))
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    ref = _ref()
    doc = _maison(codeInsee="44109")
    pv.traiter_placement(ref, doc, dry_run=False, aujourd_hui=AUJOURD_HUI)
    (update,), _ = ref.update.call_args
    assert update["estimation"] == {"statut": "PROVIDER_UNAVAILABLE", "date": "2026-10-07"}
    assert "montant" not in update


def test_plancher_au_cout_d_achat_quand_montant_nul_et_estimation_en_echec(monkeypatch):
    monkeypatch.setattr(pv.requests, "get", Reseau(cerema=_panne))
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    doc = _maison(codeInsee="44109", travaux=10000, fraisAgence=5000)
    doc["montant"] = 0
    ref = _ref()
    pv.traiter_placement(ref, doc, dry_run=False, aujourd_hui=AUJOURD_HUI)
    (update,), _ = ref.update.call_args
    assert update["montant"] == 335000  # 300 000 + 20 000 + 5 000 + 10 000


def test_plancher_s_applique_aussi_en_mode_manuel_mais_jamais_sur_une_valeur_saisie(monkeypatch):
    monkeypatch.setattr(pv.requests, "get", Reseau(cerema=_panne))
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)

    zero = _maison(codeInsee="44109")
    zero["modeValorisation"] = "manuel"
    zero["montant"] = 0
    ref = _ref()
    pv.traiter_placement(ref, zero, dry_run=False, aujourd_hui=AUJOURD_HUI)
    assert ref.update.call_args[0][0]["montant"] == 320000

    saisi = _maison(codeInsee="44109")
    saisi["modeValorisation"] = "manuel"
    saisi["montant"] = 180000
    ref = _ref()
    pv.traiter_placement(ref, saisi, dry_run=False, aujourd_hui=AUJOURD_HUI)
    assert "montant" not in ref.update.call_args[0][0]


def test_pas_de_plancher_sans_cout_d_achat(monkeypatch):
    monkeypatch.setattr(pv.requests, "get", Reseau(cerema=_panne))
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    doc = _maison(codeInsee="44109", prixAchat=None, fraisNotaire=None)
    doc["montant"] = 0
    ref = _ref()
    pv.traiter_placement(ref, doc, dry_run=False, aujourd_hui=AUJOURD_HUI)
    assert "montant" not in ref.update.call_args[0][0]


def test_dry_run_n_ecrit_rien(reseau):
    ref = _ref()
    est = pv.traiter_placement(ref, _maison(), dry_run=True, aujourd_hui=AUJOURD_HUI)
    assert est["statut"] == "OK"
    ref.update.assert_not_called()


# --- main ---------------------------------------------------------------------


def _snap(doc_id, doc):
    snap = MagicMock()
    snap.id = doc_id
    snap.exists = True
    snap.reference = MagicMock(name=f"ref_{doc_id}")
    snap.to_dict.return_value = doc
    return snap


def _db(snaps):
    db = MagicMock()
    db.collection.return_value.where.return_value.stream.return_value = snaps
    db.collection.return_value.document.return_value.get.return_value = snaps[0]
    return db


def test_un_bien_en_echec_n_interrompt_pas_les_autres(reseau, monkeypatch):
    premier = _snap("a", _maison())
    second = _snap("b", _maison())
    monkeypatch.setattr(pv, "_get_db", lambda: _db([premier, second]))

    reel = pv.estimer_bien
    appels = []

    def estimer(doc, aujourd_hui=None):
        appels.append(1)
        if len(appels) == 1:
            raise RuntimeError("bug imprévu")
        return reel(doc, AUJOURD_HUI)

    monkeypatch.setattr(pv, "estimer_bien", estimer)

    assert pv.main([]) == 1  # code retour en erreur, mais le second bien est traité
    premier.reference.update.assert_not_called()
    second.reference.update.assert_called_once()
    assert second.reference.update.call_args[0][0]["estimation"]["statut"] == "OK"


def test_main_filtre_sur_le_type_immobilier(reseau, monkeypatch):
    db = _db([_snap("a", _maison())])
    monkeypatch.setattr(pv, "_get_db", lambda: db)
    assert pv.main(["--dry-run"]) == 0
    where = db.collection.return_value.where
    assert where.call_args.kwargs["filter"].value == "immobilier"
    db.collection.assert_called_with("placements")


def test_main_placement_id_ignore_un_autre_type(reseau, monkeypatch):
    autre = _snap("x", {"type": "cash", "montant": 10})
    monkeypatch.setattr(pv, "_get_db", lambda: _db([autre]))
    assert pv.main(["--placement-id", "x"]) == 0
    autre.reference.update.assert_not_called()


def test_main_placement_id_traite_le_bien(reseau, monkeypatch):
    snap = _snap("a", _maison())
    db = _db([snap])
    monkeypatch.setattr(pv, "_get_db", lambda: db)
    assert pv.main(["--placement-id", "a"]) == 0
    db.collection.return_value.document.assert_called_with("a")
    snap.reference.update.assert_called_once()
