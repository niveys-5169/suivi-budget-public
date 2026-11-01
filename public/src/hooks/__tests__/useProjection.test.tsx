import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjection } from '../useProjection';
import { createDefaultProjectionParams } from '../../utils/projection/defaults';
import { expandVentilations } from '../../utils/ventilation';
import type { Credit, ProjectionParams, Transaction } from '../../types/banking.types';

const m = vi.hoisted(() => ({
  params: null as unknown,
  paramsLoading: false,
  transactions: [] as unknown[],
  txLoading: false,
  patrimoineLoading: false,
  save: vi.fn(),
}));

vi.mock('../useProjectionParams', () => ({
  useProjectionParams: () => ({
    params: m.params,
    exists: true,
    loading: m.paramsLoading,
    error: null,
    save: m.save,
  }),
}));
vi.mock('../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: m.transactions,
    loading: m.txLoading,
    error: null,
  }),
}));
vi.mock('../useCredits', () => ({
  useCredits: () => ({ credits: [] as Credit[], loading: false, error: null }),
}));
vi.mock('../usePatrimoine', () => ({
  usePatrimoine: () => ({
    totals: { courants: 1000, epargne: 4000, bourse: 15000, per: 9000, immobilier: 200000 },
    loading: m.patrimoineLoading,
  }),
}));
vi.mock('../../context/GlobalDataContext', () => ({
  useGlobalData: () => ({ ravConfig: { revenu_categories: ['Salaire A'] } }),
}));
vi.mock('../useBudgetExclusions', () => ({
  useBudgetExclusions: () => ({ excluded: ['Projet Extension'], loading: false }),
}));

const tx = (id: string, date: string, montant: number, categorie: string): Transaction => ({
  id,
  date,
  libelle: `Op ${id}`,
  montant,
  compte: 'Compte test',
  pointe: true,
  categorie,
});

function makeParams(over: Partial<ProjectionParams> = {}): ProjectionParams {
  const base = createDefaultProjectionParams(new Date(2026, 0, 15));
  return {
    ...base,
    horizon: { debut: '2026-01', fin: '2026-12', anneeReferencePrix: 2026 },
    ...over,
  };
}

describe('useProjection', () => {
  beforeEach(() => {
    m.params = makeParams();
    m.paramsLoading = false;
    m.txLoading = false;
    m.patrimoineLoading = false;
    m.transactions = [
      tx('a', '2026-01-10', -1200, 'Courses'),
      tx('b', '2026-06-10', -1200, 'Courses'),
      tx('c', '2026-03-10', -600, 'Loisirs'),
      tx('d', '2026-04-10', 2400, 'Salaire A'),
    ];
  });

  it('calcule le budget observé, le patrimoine hors PER et le rapport (mode auto)', () => {
    const { result } = renderHook(() => useProjection());
    expect(result.current.observed.budgetReference).toBe(250);
    expect(result.current.observed.patrimoineHorsPer).toBe(20000);
    expect(result.current.inputs.budgetReference).toBe(250);
    expect(result.current.inputs.patrimoineDepart).toBe(20000);
    expect(result.current.resultats).toHaveLength(1);
    expect(result.current.resultats[0]!.mois).toHaveLength(12);
    expect(result.current.rapport.scenarioAfficheId).toBe('s1');
    expect(result.current.rapport.annees.length).toBeGreaterThan(0);
    expect(result.current.categories).toEqual(['Courses', 'Loisirs', 'Salaire A']);
    expect(result.current.loading).toBe(false);
  });

  it('respecte le mode manuel du budget de référence', () => {
    const base = makeParams();
    m.params = makeParams({
      depenses: { ...base.depenses, budgetReference: { mode: 'manuel', manuel: 3000 } },
    });
    const { result } = renderHook(() => useProjection());
    expect(result.current.inputs.budgetReference).toBe(3000);
    expect(result.current.observed.budgetReference).toBe(250);
  });

  it('ne ventile pas deux fois les lignes déjà ventilées du contexte', () => {
    const split: Transaction = {
      ...tx('v', '2026-02-10', -1200, 'Courses'),
      ventilation: [{ montant: -600, categorie: 'Loisirs' }],
    };
    m.transactions = expandVentilations([split]);
    const { result } = renderHook(() => useProjection());
    expect(result.current.observed.budgetReference).toBe(100);
  });

  it('laisse patrimoineHorsPer à null tant que le patrimoine charge', () => {
    m.patrimoineLoading = true;
    const { result } = renderHook(() => useProjection());
    expect(result.current.observed.patrimoineHorsPer).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
