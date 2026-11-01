import type {
  ProjectionInputs,
  ProjectionPension,
  ProjectionRetraitePersonne,
  ProjectionRetraiteScenario,
  ProjectionScenarioResolu,
} from '../../types/banking.types';
import { inflationIndex, monthlyIncome } from './projectionIncome';
import { monthRange } from './projectionMonths';

const sum = (valeurs: number[]): number => valeurs.reduce((total, v) => total + v, 0);

/**
 * Pension nette après impôt d'une personne dont la retraite est calculée : moyenne, sur les mois de
 * retraite de l'horizon, du cash après PAS ramené en € de l'année de référence (Tableau de bord, lignes
 * 17 et 18 : Σ cash ÷ indice d'inflation ÷ nombre de mois). Sans mois de retraite : net avant impôt.
 */
function netApresImpotCalcule(
  inputs: ProjectionInputs,
  scenario: ProjectionScenarioResolu,
  personneId: string,
  netAvantImpot: number,
): number {
  const debut = scenario.debutsRetraite?.[personneId];
  const cash = scenario.revenusMensuels?.[personneId];
  if (!debut || !cash) return netAvantImpot;
  const mois = monthRange(debut, inputs.horizon.fin).filter((m) => cash[m] !== undefined);
  if (mois.length === 0) return netAvantImpot;
  return sum(mois.map((m) => (cash[m] ?? 0) / inflationIndex(inputs, m))) / mois.length;
}

/** Pensions (calculées, ou communes + scénario) par personne, taux de remplacement du foyer, pour chaque scénario. */
export function buildRetraite(inputs: ProjectionInputs): ProjectionRetraiteScenario[] {
  return inputs.scenarios.map((scenario) => {
    const pensions: ProjectionPension[] = [...inputs.pensionsCommunes, ...scenario.pensions];
    const parPersonne = inputs.personnes.map((personne): ProjectionRetraitePersonne => {
      const detail = scenario.retraiteDetail?.[personne.id];
      if (detail)
        return {
          personneId: personne.id,
          prenom: personne.prenom,
          netAvantImpot: detail.netAvantImpot,
          netApresImpot: netApresImpotCalcule(inputs, scenario, personne.id, detail.netAvantImpot),
          detail,
        };
      const siennes = pensions.filter((p) => p.personneId === personne.id);
      return {
        personneId: personne.id,
        prenom: personne.prenom,
        netAvantImpot: sum(siennes.map((p) => p.netAvantImpot)),
        netApresImpot: sum(siennes.map((p) => p.netApresImpot)),
      };
    });
    const totalAvantImpot = sum(parPersonne.map((p) => p.netAvantImpot));
    const totalApresImpot = sum(parPersonne.map((p) => p.netApresImpot));
    const { activite } = monthlyIncome(inputs, scenario, inputs.horizon.debut);
    const activiteFoyer = sum(Object.values(activite));
    return {
      scenarioId: scenario.id,
      nom: scenario.nom,
      parPersonne,
      totalAvantImpot,
      totalApresImpot,
      tauxRemplacement: activiteFoyer === 0 ? null : totalApresImpot / activiteFoyer,
    };
  });
}
