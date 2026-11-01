import type {
  ProjectionInputs,
  ProjectionPointAConfirmer,
  ProjectionRapport,
  ProjectionScenarioResultat,
} from '../../types/banking.types';
import { buildRetraite } from './projectionReportRetraite';
import { buildPhases, buildSynthese } from './projectionReportSynthese';
import { aggregateYears, buildControles, buildEvolution } from './projectionReportYears';

/**
 * Agrège les résultats de simulation en rapport (retraite, synthèse, évolution, phases, années,
 * contrôles). Les sections « phases » et « années » portent sur le scénario affiché.
 */
export function buildProjectionReport(
  inputs: ProjectionInputs,
  resultats: ProjectionScenarioResultat[],
  scenarioAfficheId: string,
  aConfirmer: ProjectionPointAConfirmer[],
): ProjectionRapport {
  const affiche = resultats.find((r) => r.scenarioId === scenarioAfficheId) ?? resultats[0];
  return {
    scenarioAfficheId,
    retraite: buildRetraite(inputs),
    synthese: buildSynthese(inputs, resultats),
    evolution: buildEvolution(resultats),
    phases: buildPhases(affiche),
    annees: affiche ? aggregateYears(inputs, affiche) : [],
    controles: buildControles(inputs, resultats),
    pointsAConfirmer: aConfirmer,
  };
}
