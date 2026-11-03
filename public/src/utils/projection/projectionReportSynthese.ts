import type {
  ProjectionInputs,
  ProjectionMonth,
  ProjectionMoisResultat,
  ProjectionPhaseMoyenne,
  ProjectionScenarioResultat,
  ProjectionSyntheseScenario,
} from '../../types/banking.types';
import { yearOf } from './projectionMonths';

const sum = (valeurs: number[]): number => valeurs.reduce((total, v) => total + v, 0);

/** Moyenne mensuelle par personne sur un ensemble de mois. */
function averagePerPerson(mois: ProjectionMoisResultat[]): Record<string, number> {
  const totaux: Record<string, number> = {};
  for (const m of mois) {
    for (const [id, montant] of Object.entries(m.revenusParPersonne))
      totaux[id] = (totaux[id] ?? 0) + montant;
  }
  const moyennes: Record<string, number> = {};
  for (const [id, total] of Object.entries(totaux)) moyennes[id] = total / mois.length;
  return moyennes;
}

function exhaustionMonth(
  capitalInitial: number,
  mois: ProjectionMoisResultat[],
): ProjectionMonth | null {
  let precedent = capitalInitial;
  for (const m of mois) {
    // Un capital soldé par le recalage sur le patrimoine réel n'est pas un épuisement.
    if (precedent > 0 && m.capital === 0 && !m.patrimoineReel) return m.mois;
    precedent = m.capital;
  }
  return null;
}

export function buildSynthese(
  inputs: ProjectionInputs,
  resultats: ProjectionScenarioResultat[],
): ProjectionSyntheseScenario[] {
  return resultats.map(({ scenarioId, nom, mois }) => {
    const dernier = mois[mois.length - 1];
    const n = Math.max(mois.length, 1);
    const patrimoineFinal = dernier?.patrimoineTotal ?? 0;
    const ecartAnnees = dernier ? yearOf(dernier.mois) - inputs.horizon.anneeReferencePrix : 0;
    const moyenne = (valeur: (m: ProjectionMoisResultat) => number) => sum(mois.map(valeur)) / n;
    return {
      scenarioId,
      nom,
      patrimoineFinal,
      patrimoineFinalReel: patrimoineFinal / Math.pow(1 + inputs.macro.inflation, ecartAnnees),
      capitalFinal: dernier?.capital ?? 0,
      horsPerFinal: dernier?.patrimoineHorsPer ?? 0,
      moisEpuisementCapital: exhaustionMonth(inputs.capitalInitial, mois),
      prelevementCumule: sum(mois.map((m) => m.prelevementPatrimoine)),
      moisDeficit: mois.filter((m) => m.depenses > m.revenus).length,
      revenus: moyenne((m) => m.revenus),
      revenusParPersonne: mois.length > 0 ? averagePerPerson(mois) : {},
      depenses: moyenne((m) => m.depenses),
      capacite: moyenne((m) => m.capacite),
      epargneCumulee: sum(mois.map((m) => m.capacite - m.depensesExceptionnelles)),
    };
  });
}

/** Moyennes mensuelles par phase, dans l'ordre d'apparition. */
export function buildPhases(
  resultat: ProjectionScenarioResultat | undefined,
): ProjectionPhaseMoyenne[] {
  const groupes = new Map<string, ProjectionMoisResultat[]>();
  for (const m of resultat?.mois ?? []) groupes.set(m.phase, [...(groupes.get(m.phase) ?? []), m]);
  return [...groupes.entries()].map(([phase, mois]) => {
    const moyenne = (valeur: (m: ProjectionMoisResultat) => number) =>
      sum(mois.map(valeur)) / mois.length;
    return {
      phase,
      nbMois: mois.length,
      revenusParPersonne: averagePerPerson(mois),
      caf: moyenne((m) => m.caf),
      revenus: moyenne((m) => m.revenus),
      depenses: moyenne((m) => m.depenses),
      capacite: moyenne((m) => m.capacite),
    };
  });
}
