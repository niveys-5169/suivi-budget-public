import { describe, it, expect } from 'vitest';
import {
  createDefaultProjectionParams,
  PROJECTION_MAX_SCENARIOS,
  toProjectionMonth,
} from '../projection/defaults';

describe('createDefaultProjectionParams', () => {
  const params = createDefaultProjectionParams(new Date(2026, 10, 1));

  it('horizon : du mois courant à décembre de (année + 30)', () => {
    expect(params.horizon).toEqual({ debut: '2026-11', fin: '2056-12', anneeReferencePrix: 2026 });
  });

  it('personnes génériques, sans enfant', () => {
    expect(params.personnes).toEqual([
      { id: 'p1', prenom: 'Personne 1' },
      { id: 'p2', prenom: 'Personne 2' },
    ]);
    expect(params.enfants).toEqual([]);
  });

  it('hypothèses macro par défaut', () => {
    expect(params.macro).toEqual({
      inflation: 0.02,
      rendementCapital: 0.03,
      rendementPatrimoine: 0.03,
    });
  });

  it('un seul scénario, affiché par défaut', () => {
    expect(params.scenarios).toEqual([{ id: 's1', nom: 'Scénario 1', phases: [], pensions: [] }]);
    expect(params.scenarioAfficheId).toBe('s1');
  });

  it('revenus, dépenses et capital en mode auto, sans saisie', () => {
    expect(params.revenusCommuns).toEqual({
      phases: [],
      pensions: [],
      caf: { montant: { mode: 'auto' }, evolutionAnnuelle: 0 },
    });
    expect(params.depenses).toEqual({
      budgetReference: { mode: 'auto' },
      credits: [],
      exceptionnelles: [],
    });
    expect(params.capital).toEqual({
      capitalInitial: 0,
      encaissements: [],
      patrimoineDepart: { mode: 'auto' },
    });
    expect(params.classesCategories).toEqual({});
    expect(params.aConfirmer).toEqual([]);
    expect(params.version).toBe(1);
  });

  it('pas plus de scénarios que le maximum autorisé', () => {
    expect(PROJECTION_MAX_SCENARIOS).toBe(5);
    expect(params.scenarios.length).toBeLessThanOrEqual(PROJECTION_MAX_SCENARIOS);
  });
});

describe('toProjectionMonth', () => {
  it('formate le mois sur deux chiffres', () => {
    expect(toProjectionMonth(new Date(2026, 0, 15))).toBe('2026-01');
    expect(toProjectionMonth(new Date(2026, 8, 3))).toBe('2026-09');
    expect(toProjectionMonth(new Date(2026, 10, 30))).toBe('2026-11');
  });
});
