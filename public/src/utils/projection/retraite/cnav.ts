/** Retraite de base (CNAV) : reproduit ③b (salaires portés au compte, SAM, taux, proratisation). */
import {
  ANNEE_REFERENCE_PASS,
  COEFFICIENT_REVALORISATION_PAR_ANNEE,
  DECOTE_PAR_TRIMESTRE,
  AGE_TAUX_PLEIN_AUTOMATIQUE,
  PASS_PAR_ANNEE,
  PASS_REFERENCE,
  PREMIERE_ANNEE_TABLE,
  SALAIRE_VALIDANT_TRIMESTRE,
  TAUX_PLEIN,
  TRIMESTRES_DECOTE_MAX,
  TRIMESTRES_MAX_PAR_AN,
} from './constants';

/** PASS de l'année : table légale jusqu'en 2026, puis croissance annuelle (③b B26:B71). */
export function passAnnee(annee: number, croissance: number): number {
  const connu = PASS_PAR_ANNEE[Math.max(PREMIERE_ANNEE_TABLE, annee)];
  return connu ?? PASS_REFERENCE * (1 + croissance) ** (annee - ANNEE_REFERENCE_PASS);
}

/** Coefficient de revalorisation vers l'année de référence : table jusqu'en 2026, puis 1/(1+r)^n (③b C26:C71). */
export function coefficientRevalorisation(annee: number, revalorisation: number): number {
  const connu = COEFFICIENT_REVALORISATION_PAR_ANNEE[Math.max(PREMIERE_ANNEE_TABLE, annee)];
  return connu ?? (1 + revalorisation) ** (ANNEE_REFERENCE_PASS - annee);
}

/** Salaire porté au compte : brut plafonné au PASS de l'année, revalorisé (③b K/L). */
export function salairePorteAuCompte(
  salaire: number,
  annee: number,
  croissancePass: number,
  revalorisation: number,
): number {
  return (
    Math.min(salaire, passAnnee(annee, croissancePass)) *
    coefficientRevalorisation(annee, revalorisation)
  );
}

/** Trimestres validés par un revenu annuel (③b M/N : 1 par tranche de 150 h de SMIC, 4 au maximum). */
export function trimestresDeLAnnee(revenu: number): number {
  return Math.min(TRIMESTRES_MAX_PAR_AN, Math.floor(revenu / SALAIRE_VALIDANT_TRIMESTRE));
}

/** SAM : moyenne des `nombre` meilleurs salaires portés au compte (③b ligne 84). */
export function sam(salairesPortes: number[], nombre: number): number {
  const retenus = [...salairesPortes].sort((a, b) => b - a).slice(0, nombre);
  return retenus.length === 0 ? 0 : retenus.reduce((s, v) => s + v, 0) / retenus.length;
}

/**
 * Années retenues pour le SAM (③b ligne 83) : `max` années, réduites au prorata des trimestres du régime
 * général quand d'autres régimes existent (art. R.173-4-3 CSS, arrondi supérieur), sans dépasser les années cotisées.
 */
export function nombreAnneesRetenues(
  anneesCotisees: number,
  trimestresRG: number,
  trimestresTotal: number,
  max: number,
): number {
  const prorata =
    trimestresTotal > 0 ? Math.min(max, Math.ceil((max * trimestresRG) / trimestresTotal)) : max;
  return Math.min(anneesCotisees, prorata);
}

/** Trimestres manquants pour le taux plein, plafonnés à 20 (③c B15). */
export function trimestresManquants(requis: number, valides: number): number {
  return Math.min(TRIMESTRES_DECOTE_MAX, Math.max(0, requis - valides));
}

/** Taux de liquidation : 50 % moins la décote de 1,25 % de la pension par trimestre manquant (③c B54). */
export function tauxLiquidation(manquants: number, ageLiquidation?: number): number {
  if (ageLiquidation !== undefined && ageLiquidation >= AGE_TAUX_PLEIN_AUTOMATIQUE)
    return TAUX_PLEIN;
  return TAUX_PLEIN * (1 - DECOTE_PAR_TRIMESTRE * Math.min(TRIMESTRES_DECOTE_MAX, manquants));
}

/** Proratisation régime général : trimestres du régime général ÷ trimestres requis, plafonnée à 1 (③b ligne 86). */
export function coefficientProratisation(trimestresRG: number, requis: number): number {
  return requis > 0 ? Math.min(1, trimestresRG / requis) : 1;
}

/** Pension de base mensuelle brute (③b ligne 87). */
export function pensionCnav(samAnnuel: number, taux: number, proratisation: number): number {
  return (samAnnuel * taux * proratisation) / 12;
}
