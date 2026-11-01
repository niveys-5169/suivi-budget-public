import type {
  ProjectionInputs,
  ProjectionMoisResultat,
  ProjectionMonth,
  ProjectionScenarioResolu,
  ProjectionScenarioResultat,
} from '../../types/banking.types';
import { creditPayment, earlyRepayment } from './projectionCredits';
import { cafAmount, inflationIndex, monthlyIncome } from './projectionIncome';
import { monthOfYear, monthRange } from './projectionMonths';

const sum = (valeurs: number[]): number => valeurs.reduce((total, v) => total + v, 0);
const tauxMensuel = (tauxAnnuel: number): number => Math.pow(1 + tauxAnnuel, 1 / 12) - 1;

function montantDuMois(
  liste: { montant: number; mois: ProjectionMonth }[],
  mois: ProjectionMonth,
): number {
  return sum(liste.filter((e) => e.mois === mois).map((e) => e.montant));
}

/** Simule un scénario mois par mois (règles de l'onglet ⑤b du classeur de simulation). */
export function simulateScenario(
  inputs: ProjectionInputs,
  scenario: ProjectionScenarioResolu,
): ProjectionScenarioResultat {
  const { horizon, macro, credits, abondement } = inputs;
  const listeMois = monthRange(horizon.debut, horizon.fin);
  const premierMois = listeMois[0];
  const mensualitesInitiales = premierMois
    ? sum(credits.map((c) => creditPayment(c, premierMois)))
    : 0;
  const tauxCapital = tauxMensuel(macro.rendementCapital);
  const tauxPatrimoine = tauxMensuel(macro.rendementPatrimoine);

  let capitalPrecedent = inputs.capitalInitial;
  let patrimoinePrecedent = inputs.patrimoineDepart;
  const resultats: ProjectionMoisResultat[] = listeMois.map((mois, i) => {
    const { activite, pension, phase } = monthlyIncome(inputs, scenario, mois);
    const revenusParPersonne: Record<string, number> = {};
    for (const id of Object.keys(activite))
      revenusParPersonne[id] = (activite[id] ?? 0) + (pension[id] ?? 0);
    const caf = cafAmount(inputs, mois);
    const revenus = sum(Object.values(revenusParPersonne)) + caf;

    const creditsFixes = sum(credits.map((c) => creditPayment(c, mois)));
    const depensesCourantes =
      (inputs.budgetReference - mensualitesInitiales) * inflationIndex(inputs, mois);
    const depenses = creditsFixes + depensesCourantes;
    const capacite = revenus - depenses;

    const depensesExceptionnelles = montantDuMois(inputs.exceptionnelles, mois);
    const encaissements = montantDuMois(inputs.encaissements, mois);
    const remboursementsAnticipes = sum(credits.map((c) => earlyRepayment(c, mois, horizon.fin)));

    const rendementCapital = i === 0 ? 0 : capitalPrecedent * tauxCapital;
    const brut =
      capitalPrecedent +
      capacite -
      depensesExceptionnelles +
      encaissements -
      remboursementsAnticipes +
      rendementCapital;
    const capital = Math.max(0, brut);
    const prelevementPatrimoine = Math.max(0, -brut);

    const rendementPatrimoine = i === 0 ? 0 : patrimoinePrecedent * tauxPatrimoine;
    const verse =
      abondement &&
      monthOfYear(mois) === abondement.mois &&
      (abondement.finMois === undefined || mois <= abondement.finMois);
    const abondementMois = verse && abondement ? abondement.montantAnnuel : 0;
    const patrimoineHorsPer =
      patrimoinePrecedent + rendementPatrimoine + abondementMois - prelevementPatrimoine;

    capitalPrecedent = capital;
    patrimoinePrecedent = patrimoineHorsPer;
    return {
      mois,
      phase,
      revenusParPersonne,
      caf,
      revenus,
      creditsFixes,
      depensesCourantes,
      depenses,
      capacite,
      depensesExceptionnelles,
      encaissements,
      remboursementsAnticipes,
      rendementCapital,
      capital,
      prelevementPatrimoine,
      rendementPatrimoine,
      abondement: abondementMois,
      patrimoineHorsPer,
      patrimoineTotal: capital + patrimoineHorsPer,
    };
  });
  return { scenarioId: scenario.id, nom: scenario.nom, mois: resultats };
}

/** Simule tous les scénarios des entrées. */
export function simulateAll(inputs: ProjectionInputs): ProjectionScenarioResultat[] {
  return inputs.scenarios.map((scenario) => simulateScenario(inputs, scenario));
}
