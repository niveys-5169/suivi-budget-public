import type { ProjectionParams, ProjectionScenario } from '../../../types/banking.types';
import { PROJECTION_MAX_SCENARIOS } from '../../../utils/projection/defaults';
import { newId } from './listUtils';

export const canAddScenario = (draft: ProjectionParams) =>
  draft.scenarios.length < PROJECTION_MAX_SCENARIOS;

export function addScenario(draft: ProjectionParams): { next: ProjectionParams; id: string } {
  const scenario: ProjectionScenario = {
    id: newId(),
    nom: `Scénario ${draft.scenarios.length + 1}`,
    phases: [],
    pensions: [],
  };
  return { next: { ...draft, scenarios: [...draft.scenarios, scenario] }, id: scenario.id };
}

/** Copie profonde avec de nouveaux identifiants (scénario, phases, pensions). */
export function duplicateScenario(
  draft: ProjectionParams,
  id: string,
): { next: ProjectionParams; id: string } {
  const source = draft.scenarios.find((s) => s.id === id);
  if (!source) return { next: draft, id };
  const copy: ProjectionScenario = {
    ...structuredClone(source),
    id: newId(),
    nom: `${source.nom} (copie)`,
  };
  copy.phases = copy.phases.map((p) => ({ ...p, id: newId() }));
  copy.pensions = copy.pensions.map((p) => ({ ...p, id: newId() }));
  return { next: { ...draft, scenarios: [...draft.scenarios, copy] }, id: copy.id };
}

/** Supprime un scénario (le dernier est conservé) ; le scénario affiché est réaligné si besoin. */
export function removeScenario(draft: ProjectionParams, id: string): ProjectionParams {
  if (draft.scenarios.length <= 1) return draft;
  const scenarios = draft.scenarios.filter((s) => s.id !== id);
  const scenarioAfficheId = scenarios.some((s) => s.id === draft.scenarioAfficheId)
    ? draft.scenarioAfficheId
    : (scenarios[0]?.id ?? draft.scenarioAfficheId);
  return { ...draft, scenarios, scenarioAfficheId };
}
