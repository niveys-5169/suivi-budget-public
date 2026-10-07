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
            "basse": q25 * surface,
            "haute": q75 * surface,
            "echantillon": echantillon,
            "confiance": _confiance(echantillon, echelle),
            "echelle": echelle,
        }
    return None


def _ventes_dvf(lignes: list[dict]) -> list[tuple[str, float, int]]:
    """(série de base, prix au m², pièces) des ventes mono-local exploitables d'un millésime DVF."""
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
        ventes.append((serie, prix_m2, int(_num(local.get("nombre_pieces_principales")))))
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
        for serie, prix_m2, pieces in _ventes_dvf(lignes_par_annee[annee]):
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


@dataclass
class Ajustements:
    """Correction du prix DVF : `borne × multiplicateur + ajout`, avec le détail affiché."""

    multiplicateur: float = 1.0
    ajout: float = 0.0
    detail: list[dict] = field(default_factory=list)

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


def calculer_ajustements(bien: dict, base: float, prix_m2: float) -> Ajustements:
    """Ajustements heuristiques du bien. `base` = médiane × surface, `prix_m2` = médiane au m²."""
    facteurs = _facteurs(bien)
    somme = sum(facteur for _, facteur in facteurs)
    multiplicateur = min(max(1 + somme, MULTIPLICATEUR_MIN), MULTIPLICATEUR_MAX)
    # Si le multiplicateur est borné, chaque facteur est ramené à sa part de l'effet réel
    # pour que les montants affichés somment à la correction effectivement appliquée.
    echelle = (multiplicateur - 1) / somme if somme else 1.0

    detail: list[dict] = [
        {"code": code, "facteur": facteur, "montant": round(base * facteur * echelle)}
        for code, facteur in facteurs
    ]
    ajouts = _ajouts_m2(bien)
    detail += [
        {"code": code, "m2": round(m2, 1), "montant": round(m2 * prix_m2)} for code, m2 in ajouts
    ]
    ajout = sum(m2 for _, m2 in ajouts) * prix_m2
    return Ajustements(multiplicateur=multiplicateur, ajout=ajout, detail=detail)


def cle_trimestre(jour: date) -> str:
    """Clé de trimestre `AAAAQn` d'une date (ex. 2025-07-01 → « 2025Q3 »)."""
    return f"{jour.year}Q{(jour.month - 1) // 3 + 1}"


def _derniere_valeur(serie: dict[str, float], cle: str) -> float | None:
    """Dernière valeur de la série à ce trimestre ou avant (les clés AAAAQn se trient)."""
    anterieures = [k for k in serie if k <= cle]
    return serie[max(anterieures)] if anterieures else None


def ratio_reindexation(
    serie: dict[str, float], annee_millesime, aujourd_hui: date
) -> float | None:
    """Rapport de l'indice INSEE aujourd'hui sur l'indice à mi-année du millésime DVF.

    Le point de départ est juillet de l'année du millésime. Pour chaque date on
    retient la dernière valeur publiée à cette date ou avant. None s'il manque
    l'une des deux valeurs.
    """
    try:
        depart = date(int(annee_millesime), 7, 1)
    except (TypeError, ValueError):
        return None
    valeur_depart = _derniere_valeur(serie, cle_trimestre(depart))
    valeur_actuelle = _derniere_valeur(serie, cle_trimestre(aujourd_hui))
    if not valeur_depart or valeur_actuelle is None:
        return None
    return valeur_actuelle / valeur_depart
