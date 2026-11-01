/**
 * Constantes LÉGALES publiques du calculateur d'activité de la personne 1 (congé de reclassement,
 * ARE, salariat CCN 66, libéral Cipav). Aucune valeur personnelle ici : paie, dates, coefficients
 * et charges du cabinet sont des paramètres (`ProjectionActiviteParams`).
 * Reproduit les paramètres des onglets ①, ②, ②b et ⑥ du classeur de simulation.
 */

/** Jours retenus par mois pour l'ARE (⑥ B31) et durée moyenne d'un mois en jours calendaires (②b B34). */
export const JOURS_ARE_PAR_MOIS = 30;
export const JOURS_MOYENS_PAR_MOIS = 30.44;

/** PASS annuel 2026 : 48 060 €. Source : arrêté du 22/12/2025 (JO du 23/12/2025). ① B108. */
export const PASS_ANNUEL = 48060;

/**
 * Allocation d'aide au retour à l'emploi, règles Unédic (convention du 15/11/2024, paramètres au
 * 01/07/2026). Source : circulaire Unédic 2025-03, fiche 2. ⑥ B19:B23, B50:B51.
 */
export const ARE = {
  tauxFormule1: 0.404,
  partieFixeFormule1: 13.18, // €/jour
  tauxFormule2: 0.57,
  plafondSjr: 0.75, // l'allocation ne dépasse pas 75 % du SJR
  plancherDegressivite: 92.57, // €/jour : pas de dégressivité sous ce seuil
  coefficientDegressivite: 0.7, // −30 % après 182 jours indemnisés
  joursPleinTarif: 182,
  joursDegressifs: 366,
  delaiDecheanceMois: 18 + 36, // durée du droit + 3 ans
} as const;

/** Prélèvements sociaux sur l'ARE : 3 % du SJR (art. 19 RG) et CSG/CRDS 6,7 % sur 98,25 %. ⑥ B80:B82. */
export const PRELEVEMENTS_ARE = {
  participationRetraiteComplementaire: 0.03,
  csgCrds: 0.067,
  assietteCsgCrds: 0.9825,
} as const;

/** Règle de cumul ARE + salaire : l'ARE est réduite de 70 % du brut repris. ②b B26:B27. */
export const CUMUL_ARE_SALAIRE_TAUX = 0.7;

/**
 * Différés d'indemnisation après la fin du contrat. Diviseur 111,8 au 01/01/2026 (circulaire
 * Unédic 2026-01), plafond de 75 jours en licenciement économique, délai d'attente de 7 jours.
 * ① B40:B43.
 */
export const DIFFERES = {
  diviseurSpecifique: 111.8,
  plafondJoursSpecifique: 75,
  plafondJoursCongesPayes: 30,
  delaiAttenteJours: 7,
} as const;

/** CSG + CRDS sur l'allocation de congé de reclassement : 6,7 % sur 98,25 %. ① B52. */
export const TAUX_CSG_CRDS_RECLASSEMENT = 0.0658275;

/**
 * Part salariale Agirc-Arrco prélevée sur l'allocation de reclassement (accord art. 3.2.9), taux
 * retraite + CEG par tranche et CET au-delà du PASS. Source : accord Agirc-Arrco du 17/11/2017. ① B178:B182.
 */
export const PART_SALARIALE_AGIRC_ARRCO = {
  tranche1: 0.0315 + 0.0086,
  tranche2: 0.0864 + 0.0108,
  cet: 0.0014,
} as const;

/**
 * Rémunération CCN 66 : indemnité de sujétion spéciale de 9,21 % (non-cadres en contact avec les
 * usagers) et SMIC mensuel brut 35 h au 01/06/2026. ②b B6, B8.
 */
export const CCN66 = { tauxSujetionSpeciale: 0.0921, smicMensuelBrut: 1867.02 } as const;

/**
 * Cotisations sociales Cipav 2026 (réforme assiette unique) : assiette = BNC × 74 % (abattement
 * de 26 %). Maladie-maternité : taux dégressif 3,35 % / 4,58 % / 6,5 % retenus pour les années 1,
 * 2 et 3 de montée en charge. ② B36:B46.
 */
export const COTISATIONS_LIBERAL = {
  assietteBnc: 0.74,
  maladieIj: 0.004,
  maladieMaternitePourAnnee: [0.0335, 0.0458, 0.065],
  retraiteBasePlafonnee: 0.1775,
  retraiteBaseDeplafonnee: 0.006,
  retraiteComplementairePlafonnee: 0.11,
  retraiteComplementaireAuDessus: 0.21,
  invaliditeDeces: 0.005,
  allocationsFamiliales: 0.031,
  csgCrds: 0.097,
} as const;

/**
 * Barème de l'IR pour 1 part retenu par ② (quotient familial, tranches 11 497 / 29 315 / 83 823 /
 * 180 294 €). Source : barème IR 2025 (revenus 2024), BOFiP BOI-IR-LIQ-20-10. ② B65:B66.
 */
export const BAREME_IR_IMPUTE = [
  { seuil: 0, taux: 0 },
  { seuil: 11497, taux: 0.11 },
  { seuil: 29315, taux: 0.3 },
  { seuil: 83823, taux: 0.41 },
  { seuil: 180294, taux: 0.45 },
] as const;
