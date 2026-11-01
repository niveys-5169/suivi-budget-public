import { describe, expect, it } from 'vitest';
import { PROJECTION_MAX_SCENARIOS } from '../../../../utils/projection/defaults';
import { addScenario, canAddScenario, duplicateScenario, removeScenario } from '../scenarioActions';
import { makeParams } from './fixtures';

describe('scenarioActions', () => {
  it("ajoute un scénario jusqu'au maximum", () => {
    let draft = makeParams();
    while (canAddScenario(draft)) draft = addScenario(draft).next;
    expect(draft.scenarios).toHaveLength(PROJECTION_MAX_SCENARIOS);
  });

  it('duplique avec de nouveaux identifiants', () => {
    const draft = makeParams();
    const { next, id } = duplicateScenario(draft, 's1');
    const copy = next.scenarios.find((s) => s.id === id)!;
    expect(copy.nom).toBe('Scénario test (copie)');
    expect(copy.phases[0]).toMatchObject({ libelle: 'Activité' });
    expect(copy.phases[0]!.id).not.toBe('ph1');
  });

  it('supprime un scénario, réaligne le scénario affiché et garde le dernier', () => {
    const { next, id } = duplicateScenario(makeParams(), 's1');
    const removed = removeScenario({ ...next, scenarioAfficheId: 's1' }, 's1');
    expect(removed.scenarios.map((s) => s.id)).toEqual([id]);
    expect(removed.scenarioAfficheId).toBe(id);
    expect(removeScenario(removed, id).scenarios).toHaveLength(1);
  });
});
