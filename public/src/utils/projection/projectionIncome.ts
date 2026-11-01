import type {
  ProjectionInputs,
  ProjectionMonth,
  ProjectionPhaseResolue,
  ProjectionScenarioResolu,
} from '../../types/banking.types';
import { monthIndex, yearOf } from './projectionMonths';

export interface ProjectionRevenusMois {
  /** Revenus d'activité par personne (phases communes + scénario, revalorisées). */
  activite: Record<string, number>;
  /** Pensions par personne (communes + scénario, indexées sur l'inflation). */
  pension: Record<string, number>;
  /** Libellé de la phase de scénario active, 'Retraite' si une pension du scénario est active. */
  phase: string;
}

/** Indice d'inflation : (1+i)^(année − année de référence des prix), indexé chaque 1er janvier. */
export function inflationIndex(inputs: ProjectionInputs, mois: ProjectionMonth): number {
  return Math.pow(1 + inputs.macro.inflation, yearOf(mois) - inputs.horizon.anneeReferencePrix);
}

function isActive(phase: ProjectionPhaseResolue, mois: ProjectionMonth): boolean {
  const m = monthIndex(mois);
  return m >= monthIndex(phase.debut) && (phase.fin === undefined || m <= monthIndex(phase.fin));
}

function add(cible: Record<string, number>, personneId: string, montant: number): void {
  cible[personneId] = (cible[personneId] ?? 0) + montant;
}

/** Revenus d'une personne et phase affichée pour un mois et un scénario. */
export function monthlyIncome(
  inputs: ProjectionInputs,
  scenario: ProjectionScenarioResolu,
  mois: ProjectionMonth,
): ProjectionRevenusMois {
  const activite: Record<string, number> = {};
  const pension: Record<string, number> = {};
  for (const personne of inputs.personnes) {
    activite[personne.id] = 0;
    pension[personne.id] = 0;
  }
  const annee = yearOf(mois);
  const phasesActives = [...inputs.phasesCommunes, ...scenario.phases].filter((p) =>
    isActive(p, mois),
  );
  for (const phase of phasesActives) {
    const indice = Math.pow(1 + phase.revalorisationAnnuelle, annee - yearOf(phase.debut));
    add(activite, phase.personneId, phase.netMensuel * indice);
  }
  const indiceInflation = inflationIndex(inputs, mois);
  const pensionsActives = [...inputs.pensionsCommunes, ...scenario.pensions].filter(
    (p) => monthIndex(mois) >= monthIndex(p.debut),
  );
  for (const p of pensionsActives) add(pension, p.personneId, p.netApresImpot * indiceInflation);

  const retraite = scenario.pensions.some((p) => monthIndex(mois) >= monthIndex(p.debut));
  const phaseScenario = scenario.phases.find((p) => isActive(p, mois));
  return { activite, pension, phase: retraite ? 'Retraite' : (phaseScenario?.libelle ?? '—') };
}

/** Allocations familiales : montant × (1+évolution)^(année − année de référence), jusqu'à `dernierMois`. */
export function cafAmount(inputs: ProjectionInputs, mois: ProjectionMonth): number {
  const { montant, evolutionAnnuelle, dernierMois } = inputs.caf;
  if (dernierMois !== undefined && monthIndex(mois) > monthIndex(dernierMois)) return 0;
  return (
    montant * Math.pow(1 + evolutionAnnuelle, yearOf(mois) - inputs.horizon.anneeReferencePrix)
  );
}
