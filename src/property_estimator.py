"""
property_estimator.py — Estimation immobilière : logique pure, sans réseau.
==========================================================================

Entrées : les lignes d'indicateurs annuels Cerema DV3F (prix au m² par commune
et par type de bien), le descriptif du bien et la série INSEE des prix des
logements anciens. Sortie : une valeur, une fourchette et la liste des
ajustements appliqués. Les appels HTTP et Firestore vivent dans
property_valuation.py.

Les coefficients de `calculer_ajustements` sont HEURISTIQUES : DVF n'enregistre
ni l'étage, ni le DPE, ni les extérieurs. Ce ne sont pas des valeurs calibrées,
seulement des ordres de grandeur bornés (multiplicateur dans [0,75 ; 1,25],
ajouts limités à 60 m²). Le frontend les affiche tous à l'utilisateur.
"""

import math
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

# Séries DV3F : cod111 = maisons, cod121 = appartements, cod121xN = appartements
# de N pièces (N = 1..5, 5 pour « 5 pièces et plus »).
SERIE_MAISON = "cod111"
SERIE_APPARTEMENT = "cod121"
SEUIL_VENTES_SERIE_PIECES = 20

# Départements hors DVF (livre foncier en Alsace-Moselle, Mayotte).
DEPARTEMENTS_NON_COUVERTS = {"57", "67", "68", "976"}

# Communes à arrondissements : l'IGN renvoie le code de l'arrondissement,
# Cerema publie ses indicateurs sous le code de la commune.
COMMUNES_PARENTES = (
    ("751", "75056"),  # Paris
    ("6938", "69123"),  # Lyon
    ("132", "13055"),  # Marseille
)

# Repli DVF : bornes de prix au m² au-delà desquelles une vente est jugée aberrante.
DVF_PRIX_M2_MIN = 500.0
DVF_PRIX_M2_MAX = 30000.0

# Comparables locaux : ventes DVF proches, de surface voisine, réindexées à aujourd'hui.
RAYONS_COMPARABLES_M = (300, 600, 1000, 2000)
SEUIL_COMPARABLES = 15
SEUIL_COMPARABLES_HAUTE = 30
RAYON_HAUTE_CONFIANCE_M = 600
SURFACE_COMPARABLE_MIN = 0.7
SURFACE_COMPARABLE_MAX = 1.3
NB_COMPARABLES_AFFICHES = 5

# DPE ADEME : tolérance de surface pour reconnaître le logement.
DPE_TOLERANCE_SURFACE = 0.03
DPE_TOLERANCE_SURFACE_MIN_M2 = 2.0

MULTIPLICATEUR_MIN = 0.75
MULTIPLICATEUR_MAX = 1.25
AJOUT_MAX_M2 = 60.0

M2_GARAGE = 12.0
M2_PARKING = 7.0
TERRAIN_FRANCHISE_M2 = 500.0
TERRAIN_COEF = 0.02
TERRAIN_MAX_M2 = 30.0

FACTEUR_DPE = {"A": 0.04, "B": 0.04, "C": 0.02, "D": 0.0, "E": -0.03, "F": -0.06, "G": -0.10}

SEUIL_CONFIANCE_FAIBLE = 15
SEUIL_CONFIANCE_MOYENNE = 50


def _num(value) -> float:
    """Convertit une valeur Cerema (nombre, chaîne, null) en float ; 0.0 si absente."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def departement(code_insee: str) -> str:
    """Code département d'un code INSEE de commune (3 caractères pour l'outre-mer 97x)."""
    code = str(code_insee or "")
    return code[:3] if code.startswith("97") else code[:2]


def zone_supportee(code_insee: str) -> bool:
    """Faux pour les territoires du livre foncier, absents de DVF."""
    return departement(code_insee) not in DEPARTEMENTS_NON_COUVERTS


def commune_parente(code_insee: str) -> str | None:
    """Commune parente d'un arrondissement de Paris, Lyon ou Marseille (sinon None)."""
    code = str(code_insee or "")
    for prefixe, parente in COMMUNES_PARENTES:
        if code.startswith(prefixe) and code != parente:
            return parente
    return None


def cout_achat(bien: dict) -> float:
    """Coût d'acquisition : prix + frais de notaire et d'agence + travaux."""
    return sum(
        _num(bien.get(champ)) for champ in ("prixAchat", "fraisNotaire", "fraisAgence", "travaux")
    )


def choisir_serie(nature: str, pieces, ligne: dict) -> str:
    """Série DV3F à lire pour ce bien : maison, appartement par nombre de pièces, ou appartement."""
    if nature == "maison":
        return SERIE_MAISON
    try:
        nb_pieces = min(int(pieces), 5)
    except (TypeError, ValueError):
        return SERIE_APPARTEMENT
    if nb_pieces < 1:
        return SERIE_APPARTEMENT
    serie = f"{SERIE_APPARTEMENT}x{nb_pieces}"
    if (
        _num(ligne.get(f"nbtrans_{serie}")) >= SEUIL_VENTES_SERIE_PIECES
        and _num(ligne.get(f"pxm2_median_{serie}")) > 0
    ):
        return serie
    return SERIE_APPARTEMENT


def _confiance(echantillon: int, echelle: str) -> str:
    if echelle == "departements" or echantillon < SEUIL_CONFIANCE_FAIBLE:
        return "faible"
    if echantillon < SEUIL_CONFIANCE_MOYENNE:
        return "moyenne"
    return "haute"


def construire_resultat(lignes: list[dict], bien: dict, echelle: str) -> dict | None:
    """Résultat brut (avant ajustements) du millésime le plus récent à médiane positive.

    `lignes` est triée de la plus ancienne à la plus récente. Retourne None si
    aucun millésime n'a de prix.
    """
    surface = _num(bien.get("surface"))
    for ligne in reversed(lignes):
        serie = choisir_serie(bien.get("nature"), bien.get("pieces"), ligne)
        median = _num(ligne.get(f"pxm2_median_{serie}"))
        if median <= 0:
            continue
        q25 = _num(ligne.get(f"pxm2_q25_{serie}")) or median
        q75 = _num(ligne.get(f"pxm2_q75_{serie}")) or median
        echantillon = int(_num(ligne.get(f"nbtrans_{serie}")))
        return {
            "serie": serie,
            "millesime": str(ligne.get("annee")),
            "prixM2": median,
            "valeur": median * surface,
            "q25M2": q25,
            "q75M2": q75,
            "basse": q25 * surface,
            "haute": q75 * surface,
            "echantillon": echantillon,
            "confiance": _confiance(echantillon, echelle),
            "echelle": echelle,
        }
    return None


def _ventes_dvf(lignes: list[dict]) -> list[dict]:
    """Ventes mono-local exploitables d'un millésime DVF : série, prix/m², pièces, surface, date, GPS."""
    par_mutation: dict[str, list[dict]] = defaultdict(list)
    for ligne in lignes:
        if ligne.get("nature_mutation") == "Vente" and ligne.get("type_local") in (
            "Maison",
            "Appartement",
        ):
            par_mutation[ligne.get("id_mutation")].append(ligne)

    ventes = []
    for locaux in par_mutation.values():
        if len(locaux) != 1:  # plusieurs locaux : le prix ne se répartit pas
            continue
        local = locaux[0]
        valeur, surface = _num(local.get("valeur_fonciere")), _num(local.get("surface_reelle_bati"))
        if valeur <= 0 or surface <= 0:
            continue
        prix_m2 = valeur / surface
        if not DVF_PRIX_M2_MIN <= prix_m2 <= DVF_PRIX_M2_MAX:
            continue
        serie = SERIE_MAISON if local["type_local"] == "Maison" else SERIE_APPARTEMENT
        ventes.append(
            {
                "serie": serie,
                "prix_m2": prix_m2,
                "pieces": int(_num(local.get("nombre_pieces_principales"))),
                "surface": surface,
                "date": local.get("date_mutation"),
                "lat": _num(local.get("latitude")) or None,
                "lon": _num(local.get("longitude")) or None,
            }
        )
    return ventes


def lignes_depuis_dvf(lignes_par_annee: dict[str, list[dict]]) -> list[dict]:
    """Indicateurs au format Cerema recalculés depuis les ventes DVF (repli quand le Cerema est HS).

    `lignes_par_annee` : millésime → lignes du CSV DVF géolocalisé de la commune.
    Les médianes et quartiles sont recalculés ici, pas les indicateurs officiels :
    écart possible de quelques pour cent avec le Cerema.
    """
    resultat = []
    for annee in sorted(lignes_par_annee):
        prix_par_serie: dict[str, list[float]] = defaultdict(list)
        for vente in _ventes_dvf(lignes_par_annee[annee]):
            serie, prix_m2, pieces = vente["serie"], vente["prix_m2"], vente["pieces"]
            prix_par_serie[serie].append(prix_m2)
            if serie == SERIE_APPARTEMENT and pieces >= 1:
                prix_par_serie[f"{serie}x{min(pieces, 5)}"].append(prix_m2)
        if not prix_par_serie:
            continue
        ligne: dict = {"annee": str(annee)}
        for serie in (SERIE_MAISON, SERIE_APPARTEMENT, *prix_par_serie):
            prix = prix_par_serie.get(serie, [])
            ligne[f"nbtrans_{serie}"] = len(prix)
            if prix:
                q25, mediane, q75 = (
                    statistics.quantiles(prix, n=4, method="inclusive")
                    if len(prix) > 1
                    else (prix[0],) * 3
                )
                ligne[f"pxm2_median_{serie}"] = mediane
                ligne[f"pxm2_q25_{serie}"] = q25
                ligne[f"pxm2_q75_{serie}"] = q75
        resultat.append(ligne)
    return resultat


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance à vol d'oiseau en mètres (haversine)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = (
        math.sin((phi2 - phi1) / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def _quartiles(prix: list[float]) -> tuple[float, float, float]:
    if len(prix) < 2:
        return (prix[0],) * 3
    q25, mediane, q75 = statistics.quantiles(prix, n=4, method="inclusive")
    return q25, mediane, q75


def _ecreter(candidats: list[dict]) -> list[dict]:
    """Retire les prix hors de [Q1 − 1,5·IQR ; Q3 + 1,5·IQR] (ventes atypiques)."""
    if len(candidats) < 4:
        return candidats
    q1, _, q3 = _quartiles([c["prix"] for c in candidats])
    marge = 1.5 * (q3 - q1)
    return [c for c in candidats if q1 - marge <= c["prix"] <= q3 + marge]


def comparables_locaux(
    ventes_par_annee: dict[str, list[dict]],
    bien: dict,
    lat: float,
    lon: float,
    ratios: dict[str, float] | None = None,
) -> dict | None:
    """Prix au m² tiré des ventes DVF proches du bien, au format de `construire_resultat`.

    Même nature, surface dans [0,7 ; 1,3] × celle du bien. Le rayon passe de 300 m à
    2 km jusqu'à SEUIL_COMPARABLES ventes. Chaque prix est réindexé à aujourd'hui avec
    le ratio de son millésime (`ratios`, 1 par défaut). None si les ventes manquent :
    l'appelant retombe sur la médiane communale.
    """
    ratios = ratios or {}
    surface = _num(bien.get("surface"))
    serie = SERIE_MAISON if bien.get("nature") == "maison" else SERIE_APPARTEMENT
    pool = []
    for annee, lignes in ventes_par_annee.items():
        for vente in _ventes_dvf(lignes):
            if vente["serie"] != serie or vente["lat"] is None or vente["lon"] is None:
                continue
            if not SURFACE_COMPARABLE_MIN * surface <= vente["surface"] <= SURFACE_COMPARABLE_MAX * surface:
                continue
            pool.append(
                {
                    "annee": str(annee),
                    "distance": distance_m(lat, lon, vente["lat"], vente["lon"]),
                    "prix": vente["prix_m2"] * ratios.get(str(annee), 1.0),
                    "vente": vente,
                }
            )

    for rayon in RAYONS_COMPARABLES_M:
        retenus = _ecreter([c for c in pool if c["distance"] <= rayon])
        if len(retenus) >= SEUIL_COMPARABLES:
            break
    else:
        return None

    q25, mediane, q75 = _quartiles([c["prix"] for c in retenus])
    annees = sorted(c["annee"] for c in retenus)
    plus_proches = sorted(retenus, key=lambda c: c["distance"])[:NB_COMPARABLES_AFFICHES]
    haute = len(retenus) >= SEUIL_COMPARABLES_HAUTE and rayon <= RAYON_HAUTE_CONFIANCE_M
    return {
        "serie": serie,
        "millesime": annees[0] if annees[0] == annees[-1] else f"{annees[0]}-{annees[-1]}",
        "prixM2": mediane,
        "valeur": mediane * surface,
        "q25M2": q25,
        "q75M2": q75,
        "basse": q25 * surface,
        "haute": q75 * surface,
        "echantillon": len(retenus),
        "confiance": "haute" if haute else "moyenne",
        "echelle": "voisinage",
        "rayon": rayon,
        "ratios": {annee: ratios.get(annee, 1.0) for annee in sorted(set(annees))},
        "comparables": [
            {
                "date": c["vente"]["date"],
                "distanceM": round(c["distance"]),
                "surface": round(c["vente"]["surface"]),
                "pieces": c["vente"]["pieces"],
                "prixM2": round(c["vente"]["prix_m2"]),
            }
            for c in plus_proches
        ],
    }


def choisir_dpe(candidats: list[dict], bien: dict, aujourd_hui: date) -> dict | None:
    """DPE ADEME du logement parmi les diagnostics géolocalisés autour de l'adresse.

    On ne retient que les diagnostics de même type, de surface proche (±3 %, au moins ±2 m²),
    encore valides et, si l'étage est connu, du même étage. Une seule étiquette possible
    → on la retourne (avec année de construction et étage s'ils concordent) ; sinon None :
    on ne devine pas entre plusieurs logements.
    """
    surface = _num(bien.get("surface"))
    tolerance = max(DPE_TOLERANCE_SURFACE_MIN_M2, DPE_TOLERANCE_SURFACE * surface)
    etage = bien.get("etage")
    retenus = []
    for c in candidats:
        if c.get("type_batiment") != bien.get("nature"):
            continue
        if abs(_num(c.get("surface_habitable_logement")) - surface) > tolerance:
            continue
        fin = c.get("date_fin_validite_dpe")
        if fin and str(fin)[:10] < aujourd_hui.isoformat():
            continue
        etage_dpe = c.get("numero_etage_appartement")
        if etage is not None and etage_dpe is not None and etage_dpe != etage:
            continue
        if c.get("etiquette_dpe") in FACTEUR_DPE:
            retenus.append(c)

    if not retenus or len({c["etiquette_dpe"] for c in retenus}) != 1:
        return None
    detecte: dict = {"dpe": retenus[0]["etiquette_dpe"]}
    for champ, cle in (
        ("anneeConstruction", "annee_construction"),
        ("etage", "numero_etage_appartement"),
    ):
        valeurs = {c.get(cle) for c in retenus}
        if len(valeurs) == 1 and None not in valeurs:
            detecte[champ] = valeurs.pop()
    return detecte


@dataclass
class Ajustements:
    """Correction du prix DVF : `borne × multiplicateur + ajout`, avec le détail affiché."""

    multiplicateur: float = 1.0
    ajout: float = 0.0
    detail: list[dict] = field(default_factory=list)
    somme: float = 0.0  # somme brute des facteurs, avant plafonnement
    borne: str | None = None  # "min" | "max" si le plafond a joué

    def appliquer(self, borne: float) -> float:
        """Même transformation pour la médiane, q25 et q75 : la fourchette encadre toujours l'estimation."""
        return borne * self.multiplicateur + self.ajout


def _facteurs(bien: dict) -> list[tuple[str, float]]:
    """Facteurs multiplicatifs (code, facteur) ; les facteurs nuls sont omis."""
    appartement = bien.get("nature") == "appartement"
    etage = bien.get("etage")
    nb_etages = bien.get("nbEtages")
    ascenseur = bien.get("ascenseur")
    facteurs: list[tuple[str, float]] = []

    if appartement and etage is not None:
        if etage == 0:
            facteurs.append(("GROUND_FLOOR", -0.03))
        elif etage >= 3 and ascenseur is False:
            facteurs.append(("NO_ELEVATOR", max(-0.05 - 0.01 * (etage - 3), -0.10)))
        elif ascenseur and nb_etages is not None and nb_etages >= 3 and etage == nb_etages:
            facteurs.append(("TOP_FLOOR_ELEVATOR", 0.03))

    salles_de_bain = bien.get("sallesDeBain")
    if salles_de_bain and salles_de_bain > 1:
        facteurs.append(("EXTRA_BATHROOM", min(0.02 * (salles_de_bain - 1), 0.04)))

    if bien.get("jardin"):
        facteurs.append(("GARDEN", 0.05 if appartement else 0.02))
    if bien.get("terrasse"):
        facteurs.append(("TERRACE", 0.03))
    if bien.get("balcon"):
        facteurs.append(("BALCONY", 0.015))

    dpe = bien.get("dpe")
    if dpe in FACTEUR_DPE:
        facteurs.append((f"ENERGY_{dpe}", FACTEUR_DPE[dpe]))
    elif bien.get("anneeConstruction"):
        # L'époque ne sert que sans DPE : le DPE la reflète déjà en grande partie.
        annee = bien["anneeConstruction"]
        if annee < 1949:
            facteurs.append(("ERA_PRE_1949", -0.02))
        elif annee <= 1974:
            facteurs.append(("ERA_1949_1974", -0.04))
        elif annee <= 2000:
            pass  # 1975-2000 : référence du marché, sans correction
        elif annee <= 2012:
            facteurs.append(("ERA_2001_2012", 0.02))
        else:
            facteurs.append(("ERA_POST_2012", 0.05))

    return [(code, facteur) for code, facteur in facteurs if facteur != 0]


def _ajouts_m2(bien: dict) -> list[tuple[str, float]]:
    """Ajouts en m² équivalents (code, m²), plafonnés à AJOUT_MAX_M2 au total."""
    ajouts: list[tuple[str, float]] = []
    if bien.get("garages"):
        ajouts.append(("GARAGE", M2_GARAGE * bien["garages"]))
    if bien.get("parkings"):
        ajouts.append(("PARKING", M2_PARKING * bien["parkings"]))
    terrain = _num(bien.get("terrain"))
    if bien.get("nature") == "maison" and terrain > TERRAIN_FRANCHISE_M2:
        ajouts.append(
            ("LAND", min((terrain - TERRAIN_FRANCHISE_M2) * TERRAIN_COEF, TERRAIN_MAX_M2))
        )

    total = sum(m2 for _, m2 in ajouts)
    if total > AJOUT_MAX_M2:
        ajouts = [(code, m2 * AJOUT_MAX_M2 / total) for code, m2 in ajouts]
    return ajouts


CHAMP_PAR_CODE_FACTEUR = {
    "GROUND_FLOOR": "etage",
    "NO_ELEVATOR": "etage",
    "TOP_FLOOR_ELEVATOR": "etage",
    "EXTRA_BATHROOM": "sallesDeBain",
    "GARDEN": "jardin",
    "TERRACE": "terrasse",
    "BALCONY": "balcon",
}
CHAMP_PAR_CODE_AJOUT = {"GARAGE": "garages", "PARKING": "parkings", "LAND": "terrain"}


def _champ_du_facteur(code: str) -> str:
    if code.startswith("ENERGY_"):
        return "dpe"
    if code.startswith("ERA_"):
        return "anneeConstruction"
    return CHAMP_PAR_CODE_FACTEUR.get(code, "")


def _valeur_affichee(code: str, bien: dict):
    """Valeur du bien qui motive le facteur (étiquette, étage, année…) ; True pour un équipement."""
    valeur = bien.get(_champ_du_facteur(code))
    return valeur if not isinstance(valeur, bool) else True


def calculer_ajustements(
    bien: dict, base: float, prix_m2: float, detecte: dict | None = None
) -> Ajustements:
    """Ajustements heuristiques du bien. `base` = médiane × surface, `prix_m2` = médiane au m².

    `detecte` : caractéristiques trouvées dans l'open data (DPE, année, étage). Elles
    ne comblent que les champs que l'utilisateur n'a pas saisis ; chaque ligne du détail
    indique son `origine` (« saisi » ou « ademe »).
    """
    effectif = dict(bien)
    utilises = set()
    for champ, valeur in (detecte or {}).items():
        if valeur is not None and bien.get(champ) in (None, ""):
            effectif[champ] = valeur
            utilises.add(champ)

    def origine(champ: str) -> str:
        return "ademe" if champ in utilises else "saisi"

    facteurs = _facteurs(effectif)
    somme = sum(facteur for _, facteur in facteurs)
    brut = 1 + somme
    multiplicateur = min(max(brut, MULTIPLICATEUR_MIN), MULTIPLICATEUR_MAX)
    borne = "min" if brut < MULTIPLICATEUR_MIN else "max" if brut > MULTIPLICATEUR_MAX else None
    # Si le multiplicateur est borné, chaque facteur est ramené à sa part de l'effet réel
    # pour que les montants affichés somment à la correction effectivement appliquée.
    echelle = (multiplicateur - 1) / somme if somme else 1.0

    detail: list[dict] = [
        {
            "code": code,
            "facteur": facteur,
            "facteurApplique": round(facteur * echelle, 4),
            "montant": round(base * facteur * echelle),
            "valeurBien": _valeur_affichee(code, effectif),
            "origine": origine(_champ_du_facteur(code)),
        }
        for code, facteur in facteurs
    ]
    ajouts = _ajouts_m2(effectif)
    detail += [
        {
            "code": code,
            "m2": round(m2, 1),
            "montant": round(m2 * prix_m2),
            "valeurBien": effectif.get(CHAMP_PAR_CODE_AJOUT[code]),
            "origine": "saisi",
        }
        for code, m2 in ajouts
    ]
    ajout = sum(m2 for _, m2 in ajouts) * prix_m2
    return Ajustements(
        multiplicateur=multiplicateur, ajout=ajout, detail=detail, somme=somme, borne=borne
    )


def cle_trimestre(jour: date) -> str:
    """Clé de trimestre `AAAAQn` d'une date (ex. 2025-07-01 → « 2025Q3 »)."""
    return f"{jour.year}Q{(jour.month - 1) // 3 + 1}"


def _derniere_valeur(serie: dict[str, float], cle: str) -> tuple[str, float] | None:
    """(trimestre, valeur) de la série à ce trimestre ou avant (les clés AAAAQn se trient)."""
    anterieures = [k for k in serie if k <= cle]
    if not anterieures:
        return None
    dernier = max(anterieures)
    return dernier, serie[dernier]


def detail_reindexation(serie: dict[str, float], annee_millesime, aujourd_hui: date) -> dict | None:
    """Indices INSEE et ratio entre mi-année du millésime DVF et aujourd'hui, ou None.

    Le point de départ est juillet de l'année du millésime. Pour chaque date on
    retient la dernière valeur publiée à cette date ou avant. None s'il manque
    l'une des deux valeurs.
    """
    try:
        depart = date(int(annee_millesime), 7, 1)
    except (TypeError, ValueError):
        return None
    point_depart = _derniere_valeur(serie, cle_trimestre(depart))
    point_actuel = _derniere_valeur(serie, cle_trimestre(aujourd_hui))
    if not point_depart or not point_depart[1] or point_actuel is None:
        return None
    return {
        "trimestreDepart": point_depart[0],
        "indiceDepart": point_depart[1],
        "trimestreActuel": point_actuel[0],
        "indiceActuel": point_actuel[1],
        "ratio": point_actuel[1] / point_depart[1],
    }


def ratio_reindexation(
    serie: dict[str, float], annee_millesime, aujourd_hui: date
) -> float | None:
    """Rapport de l'indice INSEE aujourd'hui sur l'indice à mi-année du millésime DVF."""
    detail = detail_reindexation(serie, annee_millesime, aujourd_hui)
    return detail["ratio"] if detail else None
