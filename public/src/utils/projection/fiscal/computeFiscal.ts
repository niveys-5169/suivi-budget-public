import type { ProjectionEnfant, ProjectionFiscalAnnee } from '../../../types/banking.types';
import { BAREME_IR } from './constants';
import { abattement10, impotFoyer, indiceBareme, partsFiscales } from './baremeIr';
import { tauxPasAnnee } from './tauxPas';

/** Revenus d'une année civile, sommés sur les seuls mois projetés (⑫ B, D, E, G ← colonnes mensuelles de ⑤b). */
export interface FiscalAnneeInput {
  annee: number;
  /** Nombre de mois projetés dans l'année (12 sauf année partielle). */
  moisProjetes: number;
  /** Personne 1 : salaires, revenus de remplacement (chômage, congé) et pensions imposables. */
  imposableP1: number;
  /** Personne 1 : BNC imposable (libéral), non soumis à l'abattement de 10 % (⑫ colonne E). */
  bncP1: number;
  /** Personne 2 : net imposable (salaire et pension). */
  imposableP2: number;
}

export interface FiscalInput {
  annees: FiscalAnneeInput[];
  enfants: ReadonlyArray<Pick<ProjectionEnfant, 'dateNaissance'>>;
  /** Taux annuel d'indexation du barème et de la grille (décimal), déjà résolu. */
  indexation: number;
  ageLimiteRattachement: number;
  tauxIndividualises: boolean;
  /** Avant cette année, les taux réels saisis s'appliquent. */
  premiereAnneeRecalculee: number;
  tauxReelsActuels: { p1: number; p2: number };
  /** Année des revenus du barème de référence (défaut : celle des constantes). */
  anneeReferenceBareme?: number;
  anneeGrille?: number;
}

/** Coefficient d'annualisation d'une année partielle : 12 / mois projetés (⑫ C). */
export function coefficientAnnualisation(moisProjetes: number): number {
  return moisProjetes > 0 ? 12 / moisProjetes : 0;
}

/** Calcule parts, revenu imposable, IR net du foyer et taux PAS de chaque année (⑫ lignes 47 à 71). */
export function computeFiscalParAnnee(input: FiscalInput): ProjectionFiscalAnnee[] {
  const anneeReference = input.anneeReferenceBareme ?? BAREME_IR.anneeRevenus;
  return input.annees.map((entree) => {
    const coef = coefficientAnnualisation(entree.moisProjetes);
    const salairesP1 = entree.imposableP1 * coef;
    const revenuP1 = salairesP1 + entree.bncP1 * coef;
    const revenuP2 = entree.imposableP2 * coef;
    const revenuNetImposable = Math.max(
      0,
      revenuP1 + revenuP2 - abattement10(salairesP1) - abattement10(revenuP2),
    );
    const parts = partsFiscales(entree.annee, input.enfants, input.ageLimiteRattachement);
    const indice = indiceBareme(entree.annee, input.indexation, anneeReference);
    const { irNet } = impotFoyer({
      revenuImposable: revenuNetImposable,
      parts,
      indiceBareme: indice,
    });
    const calcules = tauxPasAnnee({
      annee: entree.annee,
      revenuP1,
      revenuP2,
      irNet,
      tauxIndividualises: input.tauxIndividualises,
      indexation: input.indexation,
      anneeGrille: input.anneeGrille,
    });
    const reels = entree.annee < input.premiereAnneeRecalculee;
    return {
      annee: entree.annee,
      parts,
      revenuNetImposable,
      irNet,
      tauxFoyer: calcules.tauxFoyer,
      tauxP1: reels ? input.tauxReelsActuels.p1 : calcules.tauxP1,
      tauxP2: reels ? input.tauxReelsActuels.p2 : calcules.tauxP2,
    };
  });
}
