/** ARE : allocation journalière, dégressivité, prélèvements et différés (⑥ B24:B37, ① B40:B43). */
import { ARE, DIFFERES, JOURS_ARE_PAR_MOIS, PRELEVEMENTS_ARE } from './constants';

export interface AreResultat {
  sjr: number;
  /** ARE journalière brute retenue : MIN(75 % SJR ; MAX(formule 1 ; formule 2)) (⑥ B30). */
  allocationJournaliere: number;
  /** ARE journalière après dégressivité (⑥ B35). */
  allocationDegressive: number;
  degressiviteApplicable: boolean;
  /** Taux effectif des prélèvements sociaux, en proportion de l'allocation (⑥ B24). */
  tauxPrelevements: number;
  /** ARE mensuelle nette, mois 1-6 et mois suivants (⑥ B36, B37). */
  netMensuelPlein: number;
  netMensuelDegressif: number;
}

export function computeAre(sjr: number): AreResultat {
  const formule1 = sjr * ARE.tauxFormule1 + ARE.partieFixeFormule1;
  const formule2 = sjr * ARE.tauxFormule2;
  const allocationJournaliere = Math.min(sjr * ARE.plafondSjr, Math.max(formule1, formule2));
  const degressiviteApplicable = allocationJournaliere >= ARE.plancherDegressivite;
  const allocationDegressive = degressiviteApplicable
    ? Math.max(ARE.plancherDegressivite, allocationJournaliere * ARE.coefficientDegressivite)
    : allocationJournaliere;
  const { participationRetraiteComplementaire, csgCrds, assietteCsgCrds } = PRELEVEMENTS_ARE;
  const tauxPrelevements =
    (sjr * participationRetraiteComplementaire +
      allocationJournaliere * csgCrds * assietteCsgCrds) /
    allocationJournaliere;
  const net = (journalier: number) => journalier * JOURS_ARE_PAR_MOIS * (1 - tauxPrelevements);
  return {
    sjr,
    allocationJournaliere,
    allocationDegressive,
    degressiviteApplicable,
    tauxPrelevements,
    netMensuelPlein: net(allocationJournaliere),
    netMensuelDegressif: net(allocationDegressive),
  };
}

export interface DifferesInput {
  /** Part supra-légale au sens de l'assurance chômage (supra-légal + transactionnel, brut). */
  assietteSupralegale: number;
  /** Indemnité compensatrice de congés payés, brute. */
  iccpBrute: number;
  sjr: number;
}

/** Total des différés d'indemnisation en jours calendaires (① B43 : spécifique + CP + attente). */
export function computeDifferesJours({
  assietteSupralegale,
  iccpBrute,
  sjr,
}: DifferesInput): number {
  const specifique = Math.min(
    DIFFERES.plafondJoursSpecifique,
    assietteSupralegale / DIFFERES.diviseurSpecifique,
  );
  const congesPayes = Math.min(DIFFERES.plafondJoursCongesPayes, iccpBrute / sjr);
  return specifique + congesPayes + DIFFERES.delaiAttenteJours;
}
