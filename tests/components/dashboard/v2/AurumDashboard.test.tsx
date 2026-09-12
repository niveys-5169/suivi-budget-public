import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AurumDashboard } from '../../../../public/src/components/dashboard/v2/AurumDashboard';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock hooks
vi.mock('../../../../public/src/hooks/useBalances', () => ({
  useBalances: () => ({
    balances: [
      {
        id: '1',
        compte: 'Compte Courant LCL',
        current_balance: 4500,
        owner: 'Jean',
        is_savings: false,
      },
      { id: '2', compte: 'Livret A', current_balance: 111400, owner: 'Jean', is_savings: true },
    ],
    checkingBalances: [
      {
        id: '1',
        compte: 'Compte Courant LCL',
        current_balance: 4500,
        owner: 'Jean',
        is_savings: false,
      },
    ],
    checkingTotal: 4500,
    loading: false,
  }),
}));

vi.mock('../../../../public/src/hooks/useHealthScore', () => ({
  useHealthScore: () => ({
    score: 85,
    grade: 'A',
    subScores: [],
    recommendations: [],
  }),
}));

vi.mock('../../../../public/src/hooks/useCashflowForecast', () => ({
  useCashflowForecast: () => ({
    days: [
      { date: '2026-06-12', balance: 4500, events: [] },
      { date: '2026-06-13', balance: 4200, events: [] },
    ],
    lowestPoint: { date: '2026-06-13', balance: 4200 },
    breachDate: null,
    belowZeroDate: null,
    upcomingEvents: [],
  }),
}));

vi.mock('../../../../public/src/hooks/useDashboard', () => ({
  useDashboard: () => ({
    stats: { totalRec: 1000, totalDep: 500 },
    loading: false,
    monthKey: '2026-04',
    allCategories: [],
  }),
}));

vi.mock('../../../../public/src/context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: [],
    loading: false,
    updateFilters: vi.fn(),
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    togglePointe: vi.fn(),
  }),
}));

vi.mock('../../../../public/src/hooks/usePatrimoine', () => ({
  usePatrimoine: () => ({
    patrimoineSnapshots: [],
    placementHistory: [],
  }),
}));

// Mock BudgetContext by mocking useBudgetContext if needed,
// but here we try using the real Provider with mocked sub-hooks if possible.
// Wait, useBudget calls useBudgetContext.
// If we can't use the Provider easily due to internal hooks, let's mock useBudget.

vi.mock('../../../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({
    budgets: [],
    loading: false,
    getBudgetCategoryCandidates: vi.fn(() => []),
  }),
}));

vi.mock('../../../../public/src/hooks/useAlerts', () => ({
  useAlerts: () => ({
    alerts: [],
    loading: false,
  }),
}));

vi.mock('../../../../public/src/hooks/useSyncTransactions', () => ({
  useSyncTransactions: () => ({
    sync: vi.fn(),
    isSyncing: false,
  }),
}));

describe('AurumDashboard Component', () => {
  it('renders hero and accounts list', () => {
    render(
      <MemoryRouter>
        <AurumDashboard />
      </MemoryRouter>,
    );

    // Check for "Comptes Courants" (hero title and list title)
    expect(screen.getAllByText(/Comptes Courants/i).length).toBeGreaterThanOrEqual(2);

    // Check for specific account names from mock
    expect(screen.getByText('Compte Courant LCL')).toBeInTheDocument();
    // Since Livret A is a savings account, it should not be listed in the currents list
    expect(screen.queryByText('Livret A')).not.toBeInTheDocument();
  });
});
