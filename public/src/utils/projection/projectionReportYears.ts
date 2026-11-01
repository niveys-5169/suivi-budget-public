import type {
  ProjectionAnneeDetail,
  ProjectionControle,
  ProjectionEvolutionAnnee,
  ProjectionInputs,
  ProjectionMoisResultat,
  ProjectionScenarioResultat,
} from '../../types/banking.types';
import { yearOf } from './projectionMonths';

const TOLERANCE = 0.01;
const sum = (valeurs: number[]): number => valeurs.reduce((total, v) => total + v, 0);

/** Flux de chaque année civile d'un scénario ; la variation part du patrimoine initial (1re année). */
export function aggregateYears(
  inputs: ProjectionInputs,
  resultat: ProjectionScenarioResultat,
): ProjectionAnneeDetail[] {
  const parAnnee = new Map<number, ProjectionMoisResultat[]>();
  for (const m of resultat.mois) {
    const annee = yearOf(m.mois);
    parAnnee.set(annee, [...(parAnnee.get(annee) ?? []), m]);
  }
  let precedent = inputs.capitalInitial + inputs.patrimoineDepart;
  return [...parAnnee.entries()].map(([annee, mois]) => {
    const total = (valeur: (m: ProjectionMoisResultat) => number) => sum(mois.map(valeur));
    const dernier = mois[mois.length - 1];
    const patrimoineFin = dernier?.patrimoineTotal ?? precedent;
    const detail: ProjectionAnneeDetail = {
      annee,
      phaseDecembre: dernier?.phase ?? '—',
      revenus: total((m) => m.revenus),
      depenses: total((m) => m.depenses),
      capacite: total((m) => m.capacite),
      depensesExceptionnelles: total((m) => m.depensesExceptionnelles),
      encaissements: total((m) => m.encaissements),
      remboursementsAnticipes: total((m) => m.remboursementsAnticipes),
      rendements: total((m) => m.rendementCapital + m.rendementPatrimoine),
      abondement: total((m) => m.abondement),
      variationPatrimoine: patrimoineFin - precedent,
      patrimoineFin,
    };
    precedent = patrimoineFin;
    return detail;
  });
}

/** Patrimoine total en fin d'année (décembre, ou dernier mois de l'horizon) pour chaque scénario. */
export function buildEvolution(
  resultats: ProjectionScenarioResultat[],
): ProjectionEvolutionAnnee[] {
  const annees = new Set<number>();
  for (const r of resultats) for (const m of r.mois) annees.add(yearOf(m.mois));
  return [...annees]
    .sort((a, b) => a - b)
    .map((annee) => {
      const parScenario: Record<string, number> = {};
      for (const r of resultats) {
        const dernier = r.mois.filter((m) => yearOf(m.mois) === annee).pop();
        if (dernier) parScenario[r.scenarioId] = dernier.patrimoineTotal;
      }
      return { annee, parScenario };
    });
}

function fluxGap(a: ProjectionAnneeDetail): number {
  const flux =
    a.capacite -
    a.depensesExceptionnelles +
    a.encaissements -
    a.remboursementsAnticipes +
    a.rendements +
    a.abondement;
  return Math.abs(a.variationPatrimoine - flux);
}

export function buildControles(
  inputs: ProjectionInputs,
  resultats: ProjectionScenarioResultat[],
): ProjectionControle[] {
  const fluxOk = resultats.every((r) =>
    aggregateYears(inputs, r).every((a) => fluxGap(a) <= TOLERANCE),
  );
  const capitalOk = resultats.every((r) => r.mois.every((m) => m.capital >= 0));
  return [
    { id: 'variation-egale-flux', libelle: 'Variation annuelle = somme des flux', ok: fluxOk },
    { id: 'capital-non-negatif', libelle: 'Capital jamais négatif', ok: capitalOk },
  ];
}
