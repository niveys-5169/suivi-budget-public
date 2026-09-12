import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboard } from '../../public/src/hooks/useDashboard';

// ---- Mocks ----------------------------------------------------------------
//
// useDashboard composes a handful of underlying hooks/contexts. We mock each
// at module level so the hook is exercised as a *pure aggregator*, without
// pulling Firebase, the auth provider, or the global store into the test.

const txMockReturn = {
  transactions: [] as any[],
  loading: false,
  error: null as Error | null,
  togglePointe: vi.fn(),
  saveTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  requestFullLoad: vi.fn(),
};
vi.mock('../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => txMockReturn,
}));

const budgetMockReturn = {
  getBudgetCategoryCandidates: vi.fn(() => [] as string[]),
};
vi.mock('../../public/src/hooks/useBudget', () => ({
  useBudget: () => budgetMockReturn,
}));

const prefsMockReturn = {
  dashboardCategories: [] as string[],
  setDashboardCategories: vi.fn(),
};
vi.mock('../../public/src/hooks/usePreferences', () => ({
  usePreferences: () => prefsMockReturn,
}));

const appStateMockReturn = {
  monthKey: '2026-04',
  setMonthKey: vi.fn(),
};
vi.mock('../../public/src/context/AppStateContext', () => ({
  useAppState: () => appStateMockReturn,
}));

const globalDataMockReturn = {
  ravConfig: null as null | {
    revenu_mensuel_net: number | null;
    revenu_categories: string[] | null;
    depense_categories: string[] | null;
  },
};
vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: () => globalDataMockReturn,
}));

// ---- Probe ---------------------------------------------------------------

type DashboardApi = ReturnType<typeof useDashboard>;

const Probe: React.FC<{ onApi: (api: DashboardApi) => void }> = ({ onApi }) => {
  const api = useDashboard();
  React.useEffect(() => {
    onApi(api);
  }, [api, onApi]);
  return null;
};

/**
 * Mounts the hook once and returns a ref whose `.current` always points at the
 * latest API snapshot. Re-rendering after `act(...)` automatically refreshes
 * the ref via the Probe's useEffect, so tests can call setters and then read
 * the resulting state without remounting.
 */
function mount(): { current: DashboardApi } {
  const ref: { current: DashboardApi | null } = { current: null };
  render(<Probe onApi={(api) => (ref.current = api)} />);
  if (!ref.current) throw new Error('useDashboard did not initialise');
  return ref as { current: DashboardApi };
}

// ---- Tests ---------------------------------------------------------------

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMockReturn.transactions = [];
    txMockReturn.loading = false;
    txMockReturn.error = null;
    budgetMockReturn.getBudgetCategoryCandidates.mockReturnValue([]);
    prefsMockReturn.dashboardCategories = [];
    appStateMockReturn.monthKey = '2026-04';
    globalDataMockReturn.ravConfig = null;
  });

  describe('stats', () => {
    it('returns zero stats with no transactions', () => {
      const api = mount();
      expect(api.current.stats).toEqual({ totalDep: 0, totalRec: 0, solde: 0 });
    });

    it('separates expenses, incomes and computes solde', () => {
      txMockReturn.transactions = [
        { id: 't1', date: '2026-04-15', libelle: 'Salary', montant: 2000, categorie: 'Revenus' },
        { id: 't2', date: '2026-04-16', libelle: 'Groceries', montant: -120, categorie: 'Courses' },
        { id: 't3', date: '2026-04-20', libelle: 'Rent', montant: -800, categorie: 'Logement' },
      ];
      // Period defaults to current_month → monthKey 2026-04 → all 3 txs are in.
      const api = mount();
      expect(api.current.stats.totalRec).toBe(2000);
      expect(api.current.stats.totalDep).toBe(-920);
      expect(api.current.stats.solde).toBe(1080);
    });
  });

  describe('filteredTransactions by period', () => {
    const tx = (overrides: any) => ({
      id: overrides.id,
      date: overrides.date,
      libelle: overrides.libelle ?? 'tx',
      montant: overrides.montant ?? -10,
      categorie: overrides.categorie ?? 'Cat',
      ...overrides,
    });

    beforeEach(() => {
      txMockReturn.transactions = [
        tx({ id: 'a', date: '2026-04-10', moisAffectation: '2026-04' }),
        tx({ id: 'b', date: '2026-03-10', moisAffectation: '2026-03' }),
        tx({ id: 'c', date: '2025-08-10', moisAffectation: '2025-08' }),
      ];
    });

    it('current_month keeps only the configured monthKey', () => {
      const api = mount();
      expect(api.current.filteredTransactions.map((t) => t.id)).toEqual(['a']);
    });

    it('all_time returns every transaction', () => {
      const api = mount();
      act(() => api.current.setPeriod('all_time'));
      expect(api.current.filteredTransactions.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('custom range filters inclusively on both ends', () => {
      const api = mount();
      act(() => api.current.setPeriod('custom'));
      act(() => api.current.setCustomRange({ start: '2026-03-01', end: '2026-04-30' }));
      expect(api.current.filteredTransactions.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('category scope', () => {
    it('drops transactions whose category is not in selectedCategories', () => {
      txMockReturn.transactions = [
        { id: 'g', date: '2026-04-10', libelle: 'Course', montant: -10, categorie: 'Groceries' },
        { id: 'r', date: '2026-04-11', libelle: 'Rent', montant: -800, categorie: 'Rent' },
      ];
      prefsMockReturn.dashboardCategories = ['Groceries'];
      const api = mount();
      expect(api.current.filteredTransactions.map((t) => t.id)).toEqual(['g']);
    });

    it('treats missing categorie as "Non catégorisé"', () => {
      txMockReturn.transactions = [
        { id: 'u', date: '2026-04-10', libelle: 'tx', montant: -10 } as any,
      ];
      prefsMockReturn.dashboardCategories = ['Non catégorisé'];
      const api = mount();
      expect(api.current.filteredTransactions.map((t) => t.id)).toEqual(['u']);
    });
  });

  describe('allCategories', () => {
    it('merges budget candidates with categories from current transactions (fr sort)', () => {
      budgetMockReturn.getBudgetCategoryCandidates.mockReturnValue(['Logement', 'Loisirs']);
      txMockReturn.transactions = [
        {
          id: '1',
          date: '2026-04-10',
          libelle: 'a',
          montant: -10,
          categorie: 'Courses',
        },
      ];
      const api = mount();
      // fr localeCompare: 'Logement' < 'Loisirs' (g < i at position 2)
      expect(api.current.allCategories).toEqual(['Courses', 'Logement', 'Loisirs']);
    });

    it('deduplicates the union', () => {
      budgetMockReturn.getBudgetCategoryCandidates.mockReturnValue(['Courses']);
      txMockReturn.transactions = [
        {
          id: '1',
          date: '2026-04-10',
          libelle: 'a',
          montant: -10,
          categorie: 'Courses',
        },
      ];
      const api = mount();
      expect(api.current.allCategories.filter((c) => c === 'Courses')).toHaveLength(1);
    });
  });

  describe('ravConfig projection', () => {
    it('returns null fields when globalRavConfig is null', () => {
      const api = mount();
      expect(api.current.ravConfig).toEqual({
        revenu_mensuel_net: null,
        revenu_categories: null,
        depense_categories: null,
      });
    });

    it('forwards every field from globalRavConfig', () => {
      globalDataMockReturn.ravConfig = {
        revenu_mensuel_net: 3500,
        revenu_categories: ['Salaire'],
        depense_categories: ['Courses', 'Loyer'],
      };
      const api = mount();
      expect(api.current.ravConfig.revenu_mensuel_net).toBe(3500);
      expect(api.current.ravConfig.revenu_categories).toEqual(['Salaire']);
      expect(api.current.ravConfig.depense_categories).toEqual(['Courses', 'Loyer']);
    });
  });

  describe('shiftMonth', () => {
    it('advances the monthKey by the given delta and resets period to current_month', () => {
      appStateMockReturn.monthKey = '2026-04';
      const api = mount();
      act(() => api.current.setPeriod('all_time'));
      act(() => api.current.shiftMonth(1));
      expect(appStateMockReturn.setMonthKey).toHaveBeenLastCalledWith('2026-05');
    });

    it('rolls the year backward when crossing January', () => {
      appStateMockReturn.monthKey = '2026-01';
      const api = mount();
      act(() => api.current.shiftMonth(-1));
      expect(appStateMockReturn.setMonthKey).toHaveBeenLastCalledWith('2025-12');
    });
  });

  describe('loading / error pass-through', () => {
    it('forwards loading from useTransactions', () => {
      txMockReturn.loading = true;
      const api = mount();
      expect(api.current.loading).toBe(true);
    });

    it('forwards error from useTransactions', () => {
      const boom = new Error('boom');
      txMockReturn.error = boom;
      const api = mount();
      expect(api.current.error).toBe(boom);
    });
  });
});
