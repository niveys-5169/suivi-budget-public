import type { ProjectionMonth, ProjectionParams } from '../../types/banking.types';

/** Nombre maximal de scénarios de carrière comparés dans la projection. */
export const PROJECTION_MAX_SCENARIOS = 5;

/** Formate une date au format 'YYYY-MM' (heure locale). */
export function toProjectionMonth(date: Date): ProjectionMonth {
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${mois}`;
}

/**
 * Paramètres de projection par défaut, à partir de la date du jour.
 * Valeurs génériques uniquement : aucune donnée personnelle ne doit figurer ici.
 */
export function createDefaultProjectionParams(today: Date): ProjectionParams {
  const annee = today.getFullYear();
  return {
    version: 1,
    horizon: {
      debut: toProjectionMonth(today),
      fin: `${annee + 30}-12`,
      anneeReferencePrix: annee,
    },
    personnes: [
      { id: 'p1', prenom: 'Personne 1' },
      { id: 'p2', prenom: 'Personne 2' },
    ],
    enfants: [],
    macro: { inflation: 0.02, rendementCapital: 0.03, rendementPatrimoine: 0.03 },
    revenusCommuns: {
      phases: [],
      pensions: [],
      caf: { montant: { mode: 'auto' }, evolutionAnnuelle: 0 },
    },
    scenarios: [{ id: 's1', nom: 'Scénario 1', phases: [], pensions: [] }],
    scenarioAfficheId: 's1',
    depenses: {
      budgetReference: { mode: 'auto' },
      credits: [],
      exceptionnelles: [],
    },
    capital: {
      capitalInitial: 0,
      encaissements: [],
      patrimoineDepart: { mode: 'auto' },
    },
    classesCategories: {},
    aConfirmer: [],
  };
}
