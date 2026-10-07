"""Tests de src/property_estimator.py : logique pure d'estimation immobilière."""
from datetime import date

import pytest

import property_estimator
from property_estimator import (
    AJOUT_MAX_M2,
    calculer_ajustements,
    choisir_dpe,
    comparables_locaux,
    detail_reindexation,
    choisir_serie,
    cle_trimestre,
    commune_parente,
    construire_resultat,
    cout_achat,
    departement,
    lignes_depuis_dvf,
    ratio_reindexation,
    zone_supportee,
)


def _ligne(annee, **series):
    """Ligne Cerema : series = {"cod111": (median, q25, q75, ventes), ...}."""
    ligne = {"annee": str(annee)}
    for serie, (median, q25, q75, ventes) in series.items():
        ligne[f"pxm2_median_{serie}"] = median
        ligne[f"pxm2_q25_{serie}"] = q25
        ligne[f"pxm2_q75_{serie}"] = q75
        ligne[f"nbtrans_{serie}"] = ventes
    return ligne


def _codes(ajustements):
    return {a["code"]: a for a in ajustements.detail}


def _facteur(bien, code):
    return _codes(calculer_ajustements(bien, 100000, 4000))[code]["facteur"]


# --- choisir_serie ------------------------------------------------------------


def test_maison_utilise_cod111():
    assert choisir_serie("maison", 5, _ligne(2024, cod111=(3000, 2500, 3500, 100))) == "cod111"


def test_appartement_par_nombre_de_pieces_si_assez_de_ventes():
    ligne = _ligne(2024, cod121=(4000, 3500, 4500, 300), cod121x3=(3900, 3400, 4400, 20))
    assert choisir_serie("appartement", 3, ligne) == "cod121x3"


def test_appartement_repli_sous_le_seuil_de_20_ventes():
    ligne = _ligne(2024, cod121=(4000, 3500, 4500, 300), cod121x3=(3900, 3400, 4400, 19))
    assert choisir_serie("appartement", 3, ligne) == "cod121"


def test_appartement_repli_si_mediane_nulle():
    ligne = _ligne(2024, cod121=(4000, 3500, 4500, 300), cod121x3=(0, 0, 0, 50))
    assert choisir_serie("appartement", 3, ligne) == "cod121"


def test_appartement_6_pieces_et_plus_lit_la_serie_5():
    ligne = _ligne(2024, cod121=(4000, 3500, 4500, 300), cod121x5=(4200, 3600, 4800, 40))
    assert choisir_serie("appartement", 8, ligne) == "cod121x5"


@pytest.mark.parametrize("pieces", [None, 0, "abc"])
def test_appartement_sans_pieces_valides_lit_cod121(pieces):
    ligne = _ligne(2024, cod121=(4000, 3500, 4500, 300), cod121x1=(4200, 3600, 4800, 40))
    assert choisir_serie("appartement", pieces, ligne) == "cod121"


# --- construire_resultat ------------------------------------------------------


def test_resultat_prend_le_millesime_le_plus_recent_a_mediane_positive():
    lignes = [
        _ligne(2022, cod111=(3100, 2700, 3600, 200)),
        _ligne(2023, cod111=(3200, 2800, 3700, 190)),
        _ligne(2024, cod111=(0, 0, 0, 0)),
    ]
    res = construire_resultat(lignes, {"nature": "maison", "surface": 100}, "communes")
    assert res["millesime"] == "2023"
    assert res["prixM2"] == 3200
    assert res["valeur"] == 320000
    assert res["basse"] == 280000
    assert res["haute"] == 370000
    assert res["echantillon"] == 190


def test_resultat_none_sans_aucun_prix():
    lignes = [_ligne(2024, cod111=(0, 0, 0, 0))]
    assert construire_resultat(lignes, {"nature": "maison", "surface": 100}, "communes") is None
    assert construire_resultat([], {"nature": "maison", "surface": 100}, "communes") is None


@pytest.mark.parametrize(
    "ventes,echelle,attendu",
    [
        (14, "communes", "faible"),
        (15, "communes", "moyenne"),
        (49, "communes", "moyenne"),
        (50, "communes", "haute"),
        (500, "departements", "faible"),
    ],
)
def test_confiance(ventes, echelle, attendu):
    lignes = [_ligne(2024, cod111=(3000, 2500, 3500, ventes))]
    res = construire_resultat(lignes, {"nature": "maison", "surface": 80}, echelle)
    assert res["confiance"] == attendu


# --- calculer_ajustements -----------------------------------------------------


def test_bien_neutre_sans_ajustement():
    aj = calculer_ajustements({"nature": "maison", "surface": 100}, 300000, 3000)
    assert aj.multiplicateur == 1.0
    assert aj.ajout == 0
    assert aj.detail == []


def test_rez_de_chaussee():
    aj = calculer_ajustements({"nature": "appartement", "etage": 0}, 200000, 4000)
    assert _codes(aj)["GROUND_FLOOR"]["facteur"] == -0.03
    assert _codes(aj)["GROUND_FLOOR"]["montant"] == -6000
    assert aj.multiplicateur == pytest.approx(0.97)


def test_sans_ascenseur_progressif_et_plafonne():
    bien = {"nature": "appartement", "etage": 3, "ascenseur": False}
    assert _facteur(bien, "NO_ELEVATOR") == pytest.approx(-0.05)
    assert _facteur({**bien, "etage": 5}, "NO_ELEVATOR") == pytest.approx(-0.07)
    assert _facteur({**bien, "etage": 12}, "NO_ELEVATOR") == pytest.approx(-0.10)


def test_sans_ascenseur_ignore_en_dessous_du_3e_ou_si_inconnu():
    bas = {"nature": "appartement", "etage": 2, "ascenseur": False}
    inconnu = {"nature": "appartement", "etage": 6}
    assert calculer_ajustements(bas, 1e5, 4000).detail == []
    assert calculer_ajustements(inconnu, 1e5, 4000).detail == []


def test_dernier_etage_avec_ascenseur():
    bien = {"nature": "appartement", "etage": 6, "nbEtages": 6, "ascenseur": True}
    assert _facteur(bien, "TOP_FLOOR_ELEVATOR") == pytest.approx(0.03)
    petit_immeuble = {**bien, "etage": 2, "nbEtages": 2}
    assert calculer_ajustements(petit_immeuble, 1e5, 4000).detail == []


def test_salles_de_bain_supplementaires_plafonnees():
    assert _facteur({"nature": "maison", "sallesDeBain": 2}, "EXTRA_BATHROOM") == pytest.approx(0.02)
    assert _facteur({"nature": "maison", "sallesDeBain": 6}, "EXTRA_BATHROOM") == pytest.approx(0.04)
    assert calculer_ajustements({"nature": "maison", "sallesDeBain": 1}, 1e5, 3000).detail == []


def test_exterieurs():
    assert _facteur({"nature": "appartement", "jardin": True}, "GARDEN") == pytest.approx(0.05)
    assert _facteur({"nature": "maison", "jardin": True}, "GARDEN") == pytest.approx(0.02)
    bien = {"nature": "maison", "terrasse": True, "balcon": True}
    assert _facteur(bien, "TERRACE") == pytest.approx(0.03)
    assert _facteur(bien, "BALCONY") == pytest.approx(0.015)


@pytest.mark.parametrize(
    "dpe,facteur",
    [("A", 0.04), ("B", 0.04), ("C", 0.02), ("E", -0.03), ("F", -0.06), ("G", -0.10)],
)
def test_dpe(dpe, facteur):
    assert _facteur({"nature": "maison", "dpe": dpe}, f"ENERGY_{dpe}") == pytest.approx(facteur)


def test_dpe_d_neutre():
    assert calculer_ajustements({"nature": "maison", "dpe": "D"}, 1e5, 3000).detail == []


@pytest.mark.parametrize(
    "annee,code,facteur",
    [
        (1900, "ERA_PRE_1949", -0.02),
        (1960, "ERA_1949_1974", -0.04),
        (2005, "ERA_2001_2012", 0.02),
        (2020, "ERA_POST_2012", 0.05),
    ],
)
def test_epoque_sans_dpe(annee, code, facteur):
    assert _facteur({"nature": "maison", "anneeConstruction": annee}, code) == pytest.approx(facteur)


def test_epoque_1975_2000_neutre():
    bien = {"nature": "maison", "anneeConstruction": 1990}
    assert calculer_ajustements(bien, 1e5, 3000).detail == []


def test_dpe_prioritaire_sur_l_epoque():
    bien = {"nature": "maison", "dpe": "C", "anneeConstruction": 2020}
    assert set(_codes(calculer_ajustements(bien, 1e5, 3000))) == {"ENERGY_C"}


def test_multiplicateur_somme_les_facteurs_sans_borne():
    bien = {
        "nature": "appartement",
        "etage": 6,
        "nbEtages": 6,
        "ascenseur": True,
        "sallesDeBain": 4,
        "jardin": True,
        "terrasse": True,
        "balcon": True,
        "dpe": "A",
    }  # 0,03 + 0,04 + 0,05 + 0,03 + 0,015 + 0,04 = 0,205
    assert calculer_ajustements(bien, 1e5, 4000).multiplicateur == pytest.approx(1.205)


def test_multiplicateur_borne_a_075_et_125_et_montants_ramenes_a_l_effet_reel(monkeypatch):
    monkeypatch.setattr(property_estimator, "_facteurs", lambda bien: [("A", 0.4), ("B", 0.2)])
    haut = calculer_ajustements({"nature": "maison"}, 100000, 3000)
    assert haut.multiplicateur == 1.25
    assert sum(a["montant"] for a in haut.detail) == 25000
    assert haut.borne == "max" and haut.somme == pytest.approx(0.6)
    assert sum(a["facteurApplique"] for a in haut.detail) == pytest.approx(0.25)

    monkeypatch.setattr(property_estimator, "_facteurs", lambda bien: [("A", -0.4), ("B", -0.2)])
    bas = calculer_ajustements({"nature": "maison"}, 100000, 3000)
    assert bas.multiplicateur == 0.75
    assert sum(a["montant"] for a in bas.detail) == -25000
    assert bas.borne == "min"


def test_ajouts_m2_valorises_au_prix_local():
    bien = {"nature": "maison", "garages": 1, "parkings": 2, "terrain": 1000}
    aj = calculer_ajustements(bien, 300000, 3000)
    codes = _codes(aj)
    assert codes["GARAGE"]["m2"] == 12
    assert codes["PARKING"]["m2"] == 14
    assert codes["LAND"]["m2"] == 10  # (1000 - 500) × 0,02
    assert codes["GARAGE"]["montant"] == 36000
    assert aj.ajout == pytest.approx(36 * 3000)
    assert aj.multiplicateur == 1.0


def test_terrain_sous_500_m2_et_appartement_sans_terrain():
    assert calculer_ajustements({"nature": "maison", "terrain": 400}, 1e5, 3000).detail == []
    assert calculer_ajustements({"nature": "appartement", "terrain": 5000}, 1e5, 4000).detail == []


def test_plafond_du_terrain_a_30_m2():
    aj = calculer_ajustements({"nature": "maison", "terrain": 50000}, 1e5, 3000)
    assert _codes(aj)["LAND"]["m2"] == 30


def test_plafond_total_des_ajouts_a_60_m2():
    bien = {"nature": "maison", "garages": 5, "parkings": 5, "terrain": 10000}  # 125 m² bruts
    aj = calculer_ajustements(bien, 300000, 3000)
    assert aj.ajout == pytest.approx(AJOUT_MAX_M2 * 3000)
    assert sum(a["m2"] for a in aj.detail) == pytest.approx(AJOUT_MAX_M2, abs=0.2)


def test_appliquer_transforme_les_bornes_identiquement():
    bien = {"nature": "appartement", "etage": 0, "garages": 1}
    aj = calculer_ajustements(bien, 200000, 4000)
    valeur, basse, haute = (aj.appliquer(b) for b in (200000, 170000, 230000))
    assert basse < valeur < haute
    assert valeur == pytest.approx(200000 * 0.97 + 12 * 4000)
    assert haute - basse == pytest.approx((230000 - 170000) * 0.97)


# --- réindexation -------------------------------------------------------------

SERIE = {"2024Q3": 120.0, "2025Q2": 125.3, "2025Q3": 127.5, "2026Q2": 125.1}


def test_cle_trimestre():
    assert cle_trimestre(date(2025, 7, 1)) == "2025Q3"
    assert cle_trimestre(date(2026, 10, 7)) == "2026Q4"
    assert cle_trimestre(date(2026, 1, 1)) == "2026Q1"


def test_reindexation_part_du_milieu_de_l_annee_du_millesime():
    # Millésime 2025 → départ juillet 2025 (T3 = 127,5) ; aujourd'hui = T2 2026 = 125,1.
    assert ratio_reindexation(SERIE, "2025", date(2026, 6, 15)) == pytest.approx(125.1 / 127.5)


def test_reindexation_derniere_valeur_connue():
    # Octobre 2026 = T4, non publié : on prend T2 2026. Départ 2024 → T3 2024.
    assert ratio_reindexation(SERIE, "2024", date(2026, 10, 7)) == pytest.approx(125.1 / 120.0)
    # Départ 2025 (T3), aujourd'hui en T4 2025 non publié → dernière valeur ≤ 2025Q4 = T3.
    assert ratio_reindexation(SERIE, "2025", date(2025, 12, 1)) == pytest.approx(1.0)


def test_reindexation_none_si_valeur_manquante():
    assert ratio_reindexation(SERIE, "2010", date(2026, 6, 15)) is None  # rien avant 2024Q3
    assert ratio_reindexation({}, "2024", date(2026, 6, 15)) is None
    assert ratio_reindexation(SERIE, "abc", date(2026, 6, 15)) is None


# --- zones non couvertes, communes parentes, coût d'achat ---------------------


@pytest.mark.parametrize(
    "code,dep",
    [("44109", "44"), ("2A004", "2A"), ("97411", "974"), ("97611", "976"), ("75102", "75")],
)
def test_departement(code, dep):
    assert departement(code) == dep


@pytest.mark.parametrize("code", ["57463", "67482", "68224", "97611"])
def test_zones_non_couvertes(code):
    assert not zone_supportee(code)


@pytest.mark.parametrize("code", ["44109", "75102", "97411", "2A004", "13201"])
def test_zones_couvertes(code):
    assert zone_supportee(code)


@pytest.mark.parametrize(
    "code,parente",
    [("75102", "75056"), ("69383", "69123"), ("13201", "13055"), ("44109", None), ("75056", None)],
)
def test_commune_parente(code, parente):
    assert commune_parente(code) == parente


def test_cout_achat_somme_les_postes():
    bien = {"prixAchat": 200000, "fraisNotaire": 15000, "fraisAgence": 5000, "travaux": 10000}
    assert cout_achat(bien) == 230000
    assert cout_achat({}) == 0


# --- lignes_depuis_dvf --------------------------------------------------------


def _mutation(idm, valeur, local, surface, pieces="3", nature="Vente"):
    """Ligne CSV DVF géolocalisé d'une mutation à un seul local."""
    return {
        "id_mutation": idm,
        "nature_mutation": nature,
        "valeur_fonciere": str(valeur),
        "type_local": local,
        "surface_reelle_bati": str(surface),
        "nombre_pieces_principales": pieces,
    }


def test_dvf_prix_median_et_quartiles_par_serie():
    lignes = [
        _mutation(f"m{i}", 3000 * 100 + i * 10000, "Maison", 100, "5") for i in range(5)
    ]  # 3000, 3100, 3200, 3300, 3400 €/m²
    res = lignes_depuis_dvf({"2024": lignes})
    assert len(res) == 1
    ligne = res[0]
    assert ligne["annee"] == "2024"
    assert ligne["pxm2_median_cod111"] == 3200
    assert ligne["pxm2_q25_cod111"] == 3100
    assert ligne["pxm2_q75_cod111"] == 3300
    assert ligne["nbtrans_cod111"] == 5


def test_dvf_appartements_par_nombre_de_pieces_et_global():
    lignes = [
        _mutation("a", 200000, "Appartement", 50, "2"),  # 4000
        _mutation("b", 300000, "Appartement", 50, "3"),  # 6000
        _mutation("c", 400000, "Appartement", 100, "7"),  # 4000 → série 5
    ]
    ligne = lignes_depuis_dvf({"2024": lignes})[0]
    assert ligne["nbtrans_cod121"] == 3
    assert ligne["pxm2_median_cod121"] == 4000
    assert ligne["nbtrans_cod121x2"] == 1 and ligne["pxm2_median_cod121x2"] == 4000
    assert ligne["pxm2_median_cod121x3"] == 6000
    assert ligne["nbtrans_cod121x5"] == 1
    assert "nbtrans_cod121x1" not in ligne


def test_dvf_ecarte_ventes_douteuses():
    lignes = [
        _mutation("ok", 300000, "Maison", 100),
        _mutation("echange", 300000, "Maison", 100, nature="Echange"),
        _mutation("sans_prix", 0, "Maison", 100),
        _mutation("sans_surface", 300000, "Maison", 0),
        _mutation("trop_cher", 100000000, "Maison", 100),
        _mutation("trop_bas", 1000, "Maison", 100),
        _mutation("dependance", 300000, "Dépendance", 20),
    ]
    ligne = lignes_depuis_dvf({"2024": lignes})[0]
    assert ligne["nbtrans_cod111"] == 1


def test_dvf_ecarte_les_mutations_multi_locaux():
    lignes = [
        _mutation("lot", 500000, "Appartement", 50),
        _mutation("lot", 500000, "Maison", 80),
        _mutation("seul", 300000, "Maison", 100),
    ]
    ligne = lignes_depuis_dvf({"2024": lignes})[0]
    assert ligne["nbtrans_cod111"] == 1
    assert ligne["nbtrans_cod121"] == 0


def test_dvf_une_seule_vente_donne_quartiles_egaux_a_la_mediane():
    ligne = lignes_depuis_dvf({"2024": [_mutation("x", 300000, "Maison", 100)]})[0]
    assert ligne["pxm2_q25_cod111"] == ligne["pxm2_median_cod111"] == ligne["pxm2_q75_cod111"] == 3000


def test_dvf_annees_triees_et_annee_vide_ignoree():
    res = lignes_depuis_dvf(
        {
            "2024": [_mutation("x", 300000, "Maison", 100)],
            "2022": [_mutation("y", 250000, "Maison", 100)],
            "2023": [],
        }
    )
    assert [ligne["annee"] for ligne in res] == ["2022", "2024"]


def test_dvf_compatible_avec_construire_resultat():
    lignes = lignes_depuis_dvf({"2024": [_mutation(f"m{i}", 300000, "Maison", 100) for i in range(20)]})
    res = construire_resultat(lignes, {"nature": "maison", "surface": 80}, "communes")
    assert res["prixM2"] == 3000 and res["valeur"] == 240000 and res["echantillon"] == 20


# --- comparables_locaux -------------------------------------------------------

LAT, LON = 47.2184, -1.5536
M_PAR_DEG_LAT = 111_195.0


def _voisine(idm, prix_m2, metres=100.0, surface=100, local="Maison", date_="2025-03-01"):
    """Vente DVF `metres` au nord du bien."""
    ligne = _mutation(idm, prix_m2 * surface, local, surface, "5")
    ligne["latitude"] = str(LAT + metres / M_PAR_DEG_LAT)
    ligne["longitude"] = str(LON)
    ligne["date_mutation"] = date_
    return ligne


def _bien_maison():
    return {"nature": "maison", "surface": 100}


def test_comparables_prix_median_dans_le_rayon_et_reference():
    ventes = {"2025": [_voisine(f"m{i}", 3000 + 10 * i, metres=50 + 10 * i) for i in range(20)]}
    res = comparables_locaux(ventes, _bien_maison(), LAT, LON)
    assert res["echelle"] == "voisinage"
    assert res["rayon"] == 300
    assert res["echantillon"] == 20
    assert res["prixM2"] == pytest.approx(3095)
    assert res["valeur"] == pytest.approx(309500)
    assert res["q25M2"] < res["prixM2"] < res["q75M2"]
    assert res["basse"] == pytest.approx(res["q25M2"] * 100)
    assert res["confiance"] == "moyenne"  # 20 ventes < 30
    assert res["millesime"] == "2025"
    assert len(res["comparables"]) == 5
    distances = [c["distanceM"] for c in res["comparables"]]
    assert distances == sorted(distances)
    assert set(res["comparables"][0]) == {"date", "distanceM", "surface", "pieces", "prixM2"}


def test_comparables_haute_confiance_si_30_ventes_proches():
    ventes = {"2025": [_voisine(f"m{i}", 3000, metres=100) for i in range(30)]}
    assert comparables_locaux(ventes, _bien_maison(), LAT, LON)["confiance"] == "haute"


def test_comparables_rayon_elargi_jusqu_au_seuil():
    proches = [_voisine(f"p{i}", 3000, metres=100) for i in range(5)]
    loin = [_voisine(f"l{i}", 3000, metres=800) for i in range(12)]
    res = comparables_locaux({"2025": proches + loin}, _bien_maison(), LAT, LON)
    assert res["rayon"] == 1000 and res["echantillon"] == 17
    assert res["confiance"] == "moyenne"


def test_comparables_insuffisants_donnent_none():
    ventes = {"2025": [_voisine(f"m{i}", 3000) for i in range(14)]}
    assert comparables_locaux(ventes, _bien_maison(), LAT, LON) is None
    hors_rayon = {"2025": [_voisine(f"m{i}", 3000, metres=5000) for i in range(30)]}
    assert comparables_locaux(hors_rayon, _bien_maison(), LAT, LON) is None


def test_comparables_filtrent_nature_et_surface():
    bons = [_voisine(f"b{i}", 3000) for i in range(15)]
    ecartes = [
        _voisine("app", 9000, local="Appartement"),
        _voisine("petit", 9000, surface=60),
        _voisine("grand", 9000, surface=140),
    ]
    res = comparables_locaux({"2025": bons + ecartes}, _bien_maison(), LAT, LON)
    assert res["echantillon"] == 15 and res["prixM2"] == 3000


def test_comparables_ignorent_les_ventes_sans_coordonnees():
    sans_gps = [_mutation(f"s{i}", 300000, "Maison", 100) for i in range(30)]
    assert comparables_locaux({"2025": sans_gps}, _bien_maison(), LAT, LON) is None


def test_comparables_ecretent_les_valeurs_aberrantes():
    ventes = [_voisine(f"m{i}", 3000 + i, metres=100) for i in range(20)]
    ventes.append(_voisine("fou", 25000, metres=100))
    res = comparables_locaux({"2025": ventes}, _bien_maison(), LAT, LON)
    assert res["echantillon"] == 20
    assert res["prixM2"] < 3100


def test_comparables_reindexent_chaque_annee():
    ventes = {
        "2023": [_voisine(f"a{i}", 3000, date_="2023-05-01") for i in range(10)],
        "2025": [_voisine(f"b{i}", 3000, date_="2025-05-01") for i in range(10)],
    }
    res = comparables_locaux(
        ventes, _bien_maison(), LAT, LON, ratios={"2023": 1.10, "2025": 1.0}
    )
    assert res["millesime"] == "2023-2025"
    assert res["prixM2"] == pytest.approx(3150)  # médiane de 10×3300 et 10×3000
    assert res["ratios"] == {"2023": 1.10, "2025": 1.0}
    assert {c["prixM2"] for c in res["comparables"]} <= {3000}  # prix brut affiché


# --- choisir_dpe --------------------------------------------------------------

AUJOURD_HUI = date(2026, 10, 7)


def _dpe(etiquette="D", surface=60.0, **extra):
    ligne = {
        "etiquette_dpe": etiquette,
        "surface_habitable_logement": surface,
        "type_batiment": "appartement",
        "date_fin_validite_dpe": "2034-01-01",
    }
    ligne.update(extra)
    return ligne


def _appart(**extra):
    return {"nature": "appartement", "surface": 60, **extra}


def test_dpe_unique_est_retenu_avec_annee_et_etage():
    cand = [_dpe("D", 60.5, annee_construction=1962, numero_etage_appartement=4)]
    assert choisir_dpe(cand, _appart(), AUJOURD_HUI) == {
        "dpe": "D",
        "anneeConstruction": 1962,
        "etage": 4,
    }


def test_dpe_etiquettes_concordantes_malgre_plusieurs_candidats():
    cand = [_dpe("E", 60), _dpe("E", 59.5), _dpe("E", 60.8)]
    assert choisir_dpe(cand, _appart(), AUJOURD_HUI) == {"dpe": "E"}


def test_dpe_ambigu_ne_devine_pas():
    assert choisir_dpe([_dpe("D", 60), _dpe("F", 60.5)], _appart(), AUJOURD_HUI) is None


def test_dpe_ecarte_surface_type_expiration_et_etage():
    cand = [
        _dpe("A", 80),  # mauvaise surface
        _dpe("B", 60, type_batiment="maison"),
        _dpe("C", 60, date_fin_validite_dpe="2026-10-06"),  # expiré
        _dpe("G", 60, numero_etage_appartement=2),  # autre étage
    ]
    assert choisir_dpe(cand, _appart(etage=4), AUJOURD_HUI) is None
    assert choisir_dpe(cand, _appart(etage=2), AUJOURD_HUI) == {"dpe": "G", "etage": 2}


def test_dpe_sans_candidat_ou_etiquette_inconnue():
    assert choisir_dpe([], _appart(), AUJOURD_HUI) is None
    assert choisir_dpe([_dpe(None, 60)], _appart(), AUJOURD_HUI) is None


# --- detail_reindexation / justification des ajustements ------------------------


def test_detail_reindexation_donne_indices_et_trimestres():
    serie = {"2024Q3": 120.0, "2026Q2": 125.1}
    detail = detail_reindexation(serie, "2024", date(2026, 10, 7))
    assert detail == {
        "trimestreDepart": "2024Q3",
        "indiceDepart": 120.0,
        "trimestreActuel": "2026Q2",
        "indiceActuel": 125.1,
        "ratio": pytest.approx(125.1 / 120.0),
    }
    assert detail_reindexation(serie, "2010", date(2026, 10, 7)) is None


def test_ajustements_valeur_origine_et_facteur_applique():
    bien = {"nature": "appartement", "etage": 0, "garages": 1}
    aj = calculer_ajustements(bien, 100000, 4000, detecte={"dpe": "G"})
    detail = _codes(aj)
    assert detail["GROUND_FLOOR"]["valeurBien"] == 0
    assert detail["GROUND_FLOOR"]["origine"] == "saisi"
    assert detail["ENERGY_G"]["valeurBien"] == "G"
    assert detail["ENERGY_G"]["origine"] == "ademe"
    assert detail["GARAGE"]["valeurBien"] == 1
    assert detail["ENERGY_G"]["facteurApplique"] == pytest.approx(-0.10)
    assert aj.somme == pytest.approx(-0.13) and aj.borne is None


def test_la_saisie_prime_sur_le_dpe_detecte():
    aj = calculer_ajustements({"nature": "maison", "dpe": "B"}, 1e5, 3000, detecte={"dpe": "G"})
    assert set(_codes(aj)) == {"ENERGY_B"}
    assert _codes(aj)["ENERGY_B"]["origine"] == "saisi"


def test_somme_des_facteurs_et_absence_de_plafond_atteint():
    bien = {"nature": "appartement", "etage": 10, "ascenseur": False, "dpe": "G"}
    aj = calculer_ajustements(bien, 100000, 4000)
    assert aj.somme == pytest.approx(-0.20)  # -0,10 (étage) -0,10 (DPE)
    assert aj.borne is None  # ×0,80 reste dans [0,75 ; 1,25]
