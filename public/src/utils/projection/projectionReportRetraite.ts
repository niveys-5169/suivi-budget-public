import type {
  ProjectionInputs,
  ProjectionPension,
  ProjectionRetraiteScenario,
} from '../../types/banking.types';
import { monthlyIncome } from './projectionIncome';

const sum = (valeurs: number[]): number => valeurs.reduce((total, v) => total + v, 0);

/** Pensions (communes + scénario) par personne, taux de remplacement du foyer, pour chaque scénario. */
export function buildRetraite(inputs: ProjectionInputs): ProjectionRetraiteScenario[] {
  return inputs.scenarios.map((scenario) => {
    const pensions: ProjectionPension[] = [...inputs.pensionsCommunes, ...scenario.pensions];
    const parPersonne = inputs.personnes.map((personne) => {
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
