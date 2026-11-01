import type { ProjectionEnfant } from '../../../types/banking.types';
import {
  ABATTEMENT_10_POUR_CENT,
  BAREME_IR,
  DECOTE_COUPLE,
  PLAFOND_AVANTAGE_QF_DEMI_PART,
} from './constants';

/** Parts d'un couple sans enfant. */
const PARTS_COUPLE = 2;
/** Parts par enfant rattaché (⑫ col. K : ½ part, sans distinction du rang). */
const PART_PAR_ENFANT = 0.5;

/** Âge en années révolues au 1er janvier de `annee` (DATEDIF « y ») ; undefined si date illisible. */
function ageAu1erJanvier(dateNaissance: string, annee: number): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateNaissance);
  if (!match) return undefined;
  const [naissance, mois, jour] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const anniversairePasse = mois === 1 && jour === 1 ? 0 : 1;
  return annee - naissance - anniversairePasse;
}

/**
 * Parts fiscales d'un couple : 2 + ½ par enfant dont l'âge au 1er janvier est inférieur à la limite
 * (⑫ col. K, ①b B151:B153). Un enfant pas encore né au 1er janvier compte (âge négatif).
 */
export function partsFiscales(
  annee: number,
  enfants: ReadonlyArray<Pick<ProjectionEnfant, 'dateNaissance'>>,
  ageLimite: number,
): number {
  const rattaches = enfants.filter((enfant) => {
    const age = ageAu1erJanvier(enfant.dateNaissance, annee);
    return age !== undefined && age < ageLimite;
  });
  return PARTS_COUPLE + PART_PAR_ENFANT * rattaches.length;
}

/** Indice du barème : (1 + indexation)^(année − année des revenus du barème de référence). */
export function indiceBareme(annee: number, indexation: number, anneeReference: number): number {
  return (1 + indexation) ** (annee - anneeReference);
}

/** Abattement de 10 % d'une personne : min(revenu, max(10 %, minimum), maximum) ; 0 si pas de revenu (⑫ H, I). */
export function abattement10(revenu: number): number {
  if (revenu <= 0) return 0;
  const { taux, minimum, maximum } = ABATTEMENT_10_POUR_CENT;
  return Math.min(revenu, Math.max(revenu * taux, minimum), maximum);
}

/** Impôt du barème pour 1 part (tranches par taux marginal additionnel, seuils × indice, ⑫ M/N). */
export function impotBareme(revenuParPart: number, indice: number): number {
  return BAREME_IR.tranches.reduce((total, tranche, i) => {
    const seuil = tranche.seuil * indice;
    if (revenuParPart <= seuil) return total;
    const increment = tranche.taux - (BAREME_IR.tranches[i - 1]?.taux ?? 0);
    return total + (revenuParPart - seuil) * increment;
  }, 0);
}

export interface ImpotFoyerInput {
  /** Revenu net imposable du foyer (après abattements). */
  revenuImposable: number;
  /** Parts du foyer (≥ 2 : couple). */
  parts: number;
  /** Indice du barème (voir `indiceBareme`). */
  indiceBareme: number;
}

export interface ImpotFoyerResultat {
  /** Impôt après plafonnement du quotient familial, avant décote. */
  impotBrut: number;
  decote: number;
  irNet: number;
}

/**
 * IR d'un couple avec enfants : barème par part, avantage du quotient familial plafonné par
 * demi-part supplémentaire (⑫ M à R), puis décote couple. Formule de couple : à utiliser avec ≥ 2 parts.
 */
export function impotFoyer({
  revenuImposable,
  parts,
  indiceBareme: indice,
}: ImpotFoyerInput): ImpotFoyerResultat {
  const impotCouple = PARTS_COUPLE * impotBareme(revenuImposable / PARTS_COUPLE, indice);
  const impotToutesParts = parts * impotBareme(revenuImposable / parts, indice);
  const demiPartsSupplementaires = Math.max(0, (parts - PARTS_COUPLE) * 2);
  const plafond = demiPartsSupplementaires * PLAFOND_AVANTAGE_QF_DEMI_PART * indice;
  const impotBrut = Math.max(impotToutesParts, impotCouple - plafond);
  const { forfait, coefficient } = DECOTE_COUPLE;
  const decote = Math.max(0, Math.min(impotBrut, forfait * indice - coefficient * impotBrut));
  return { impotBrut, decote, irNet: Math.max(0, impotBrut - decote) };
}
