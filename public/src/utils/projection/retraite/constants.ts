/**
 * Constantes LÉGALES publiques du calculateur de retraite (reproduit ③, ③b, ③c du classeur).
 * Aucune donnée personnelle : les paramètres de l'utilisateur sont dans ProjectionRetraiteParams.
 */

/** Taux de liquidation CNAV à taux plein (art. L.351-1 CSS). */
export const TAUX_PLEIN = 0.5;

/** Décote : 1,25 % de la pension par trimestre manquant, plafonnée à 20 trimestres (art. L.351-1-2 CSS). */
export const DECOTE_PAR_TRIMESTRE = 0.0125;
export const TRIMESTRES_DECOTE_MAX = 20;

/** Âge à partir duquel le taux plein est acquis quel que soit le nombre de trimestres. */
export const AGE_TAUX_PLEIN_AUTOMATIQUE = 67;

/** Nombre de meilleures années retenues pour le salaire annuel moyen (SAM). */
export const NOMBRE_MEILLEURES_ANNEES = 25;

/** Salaire annuel validant un trimestre (150 h × SMIC horaire au 01/01/2026, gardé constant). */
export const SALAIRE_VALIDANT_TRIMESTRE = 1803;

/** Maximum de trimestres validés par année civile. */
export const TRIMESTRES_MAX_PAR_AN = 4;

/** Prélèvements sociaux du retraité à taux plein : CSG 8,3 % + CRDS 0,5 % + CASA 0,3 %. */
export const TAUX_PRELEVEMENTS_SOCIAUX_DEFAUT = 0.091;

/** Agirc-Arrco : taux contractuels générateurs de points (tranche 1 jusqu'à 1 PASS, tranche 2 de 1 à 8 PASS). */
export const AGIRC_ARRCO_TAUX_T1 = 0.062;
export const AGIRC_ARRCO_TAUX_T2 = 0.17;
export const AGIRC_ARRCO_PLAFOND_PASS = 8;

/** Agirc-Arrco : abattement approché de 1 % par trimestre manquant (③c B58). */
export const AGIRC_ARRCO_ABATTEMENT_PAR_TRIMESTRE = 0.01;

/**
 * Valeurs par défaut du point Agirc-Arrco (gelées au 01/11/2025, circulaire Agirc-Arrco 2025-15-DT).
 * Valeur de service : revalorisation suivante prévue au 01/11/2026 (à mettre à jour).
 */
export const AGIRC_ARRCO_VALEUR_SERVICE_DEFAUT = 1.4386;
export const AGIRC_ARRCO_PRIX_POINT_DEFAUT = 20.1877;

/** Année de référence des tables ci-dessous (€ 2026) et PASS 2026 = 48 060 € (arrêté du 22/12/2025). */
export const ANNEE_REFERENCE_PASS = 2026;
export const PASS_REFERENCE = 48060;
/** Première année des tables : les années antérieures prennent les valeurs de cette année. */
export const PREMIERE_ANNEE_TABLE = 2005;

/** PASS annuel par année civile : arrêtés annuels du PASS (valeur mensuelle × 12). */
export const PASS_PAR_ANNEE: Readonly<Record<number, number>> = {
  2005: 30192,
  2006: 31068,
  2007: 32184,
  2008: 33276,
  2009: 34308,
  2010: 34620,
  2011: 35352,
  2012: 36372,
  2013: 37032,
  2014: 37548,
  2015: 38040,
  2016: 38616,
  2017: 39228,
  2018: 39732,
  2019: 40524,
  2020: 41136,
  2021: 41136,
  2022: 41136,
  2023: 43992,
  2024: 46368,
  2025: 47100,
  2026: PASS_REFERENCE,
};

/** Coefficients de revalorisation des salaires portés au compte (Cnav 2026), ramenés en € 2026. */
export const COEFFICIENT_REVALORISATION_PAR_ANNEE: Readonly<Record<number, number>> = {
  2005: 1.348,
  2006: 1.324,
  2007: 1.302,
  2008: 1.29,
  2009: 1.279,
  2010: 1.267,
  2011: 1.256,
  2012: 1.231,
  2013: 1.205,
  2014: 1.191,
  2015: 1.191,
  2016: 1.19,
  2017: 1.19,
  2018: 1.181,
  2019: 1.164,
  2020: 1.153,
  2021: 1.149,
  2022: 1.137,
  2023: 1.085,
  2024: 1.031,
  2025: 1.009,
  2026: 1,
};
