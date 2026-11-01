/** Code et libellé de phase d'un mois (Calc colonnes AF et B). Le test utilise le milieu du mois (1er + 14 jours). */
import type { Calendrier } from './calendrier';

/** Codes de phase (colonne AF) : 5 + n = libéral, année n de montée en charge (1 à 3). */
export const CODE_PHASE = {
  emploi: 1,
  conge: 2,
  association: 3,
  associationSansAre: 4,
  liberalAn1: 5,
  retraite: 8,
} as const;

/** Année de montée en charge du libéral (1 à 3), selon l'année civile écoulée depuis la bascule (Calc AU). */
export function anneeLiberal(annee: number, anneeBascule: number): number {
  return Math.min(3, Math.max(1, annee - anneeBascule));
}

/** Code de phase du mois commençant à `debut` (Calc AF). */
export function codePhase(
  debut: number,
  cal: Calendrier,
  retraite: boolean,
  anneeLib: number,
): number {
  const milieu = debut + 14;
  if (retraite) return CODE_PHASE.retraite;
  if (milieu < cal.finPreavis) return CODE_PHASE.emploi;
  if (milieu < cal.debutAssociation) return CODE_PHASE.conge;
  if (milieu >= cal.bascule) return CODE_PHASE.associationSansAre + anneeLib;
  return milieu < cal.finComplement ? CODE_PHASE.association : CODE_PHASE.associationSansAre;
}

/** Libellé de la phase (Calc B) ; `mesuresParAnnee` = mesures de la montée en charge (années 1 à 3). */
export function libellePhase(
  code: number,
  debut: number,
  cal: Calendrier,
  mesuresParAnnee: number[],
): string {
  if (code === CODE_PHASE.retraite) return 'Retraite';
  if (code === CODE_PHASE.emploi) return 'Situation actuelle';
  if (code === CODE_PHASE.conge) return 'Congé de reclassement';
  if (code === CODE_PHASE.associationSansAre) return 'Association sans ARE';
  if (code === CODE_PHASE.association) {
    return debut + 14 < cal.debutComplement
      ? 'Association (différé ARE)'
      : 'Association + complément ARE';
  }
  return `Libéral — ${mesuresParAnnee[code - CODE_PHASE.liberalAn1] ?? 0} mesures`;
}
