/** Retraite complémentaire Agirc-Arrco : reproduit ③ bloc B et ③c (points × valeur de service). */
import {
  AGIRC_ARRCO_ABATTEMENT_PAR_TRIMESTRE,
  AGIRC_ARRCO_PLAFOND_PASS,
  AGIRC_ARRCO_TAUX_T1,
  AGIRC_ARRCO_TAUX_T2,
} from './constants';
import { coefficientRevalorisation, passAnnee } from './cnav';

interface PointsOptions {
  croissancePass: number;
  revalorisationSalaires: number;
  /** Prix d'achat du point (salaire de référence, € de l'année de référence). */
  prixPoint: number;
}

/**
 * Points acquis sur une année : cotisation contractuelle (6,2 % jusqu'au PASS, 17 % de 1 à 8 PASS),
 * ramenée en € 2026 puis divisée par le prix d'achat du point (③c H25:H49).
 */
export function pointsAgircArrcoAnnee(
  assiette: number,
  annee: number,
  opts: PointsOptions,
): number {
  const pass = passAnnee(annee, opts.croissancePass);
  const tranche1 = Math.min(assiette, pass);
  const tranche2 = Math.min(Math.max(0, assiette - pass), (AGIRC_ARRCO_PLAFOND_PASS - 1) * pass);
  const cotisation = tranche1 * AGIRC_ARRCO_TAUX_T1 + tranche2 * AGIRC_ARRCO_TAUX_T2;
  return (
    (cotisation * coefficientRevalorisation(annee, opts.revalorisationSalaires)) / opts.prixPoint
  );
}

/** Pension mensuelle brute : points × valeur de service ÷ 12, abattue de 1 % par trimestre manquant (③c B59). */
export function pensionAgircArrco(
  points: number,
  valeurService: number,
  manquants: number,
): number {
  return (points * valeurService * (1 - AGIRC_ARRCO_ABATTEMENT_PAR_TRIMESTRE * manquants)) / 12;
}
