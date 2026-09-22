import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnalyseSection } from '../AnalyseSection';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const monthlySavingsSpy = vi.hoisted(() =>
  vi.fn(() => ({ position: null, loading: true, error: null })),
);

// Mock hooks
vi.mock('../../../hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [
      { id: '1', date: '2026-04-01', libelle: 'Salaire', montant: 3000, categorie: 'Salaire' },
      { id: '2', date: '2026-04-05', libelle: 'Loyer', montant: -1000, categorie: 'Logement' },
      { id: '3', date: '2026-04-10', libelle: 'Courses', montant: -150, categorie: 'Alimentation' },
    ],
    filteredTransactions: [
      { id: '1', date: '2026-04-01', libelle: 'Salaire', montant: 3000, categorie: 'Salaire' },
      { id: '2', date: '2026-04-05', libelle: 'Loyer', montant: -1000, categorie: 'Logement' },
      { id: '3', date: '2026-04-10', libelle: 'Courses', montant: -150, categorie: 'Alimentation' },
    ],
    filters: { year: '2026', month: '04' },
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
    pointAll: vi.fn(),
    unpointAll: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDashboard', () => ({
  useDashboard: () => ({
    transactions: [
      { id: '1', date: '2026-04-01', libelle: 'Salaire', montant: 3000, categorie: 'Salaire' },
      { id: '2', date: '2026-04-05', libelle: 'Loyer', montant: -1000, categorie: 'Logement' },
      { id: '3', date: '2026-04-10', libelle: 'Courses', montant: -150, categorie: 'Alimentation' },
    ],
    loading: false,
    error: null,
    monthKey: '2026-04',
    shiftMonth: vi.fn(),
    recurringSettings: [],
  }),
}));

vi.mock('../../../context/AppStateContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../context/AppStateContext')>()),
  useAppState: () => ({
    monthKey: '2026-04',
    setMonthKey: vi.fn(),
    budgetCalculationScope: 'all',
  }),
}));

vi.mock('../../../context/GlobalDataContext', () => ({
  useGlobalData: () => ({
    accountBalances: [],
    ownerMapping: {
      owners: ['Nicolas', 'Romane'],
      accounts: {},
      savings_patterns: {},
      default_owner: 'Nicolas',
    },
    ravConfig: null,
    recurringSettings: [],
    recurrences: [],
    loading: false,
  }),
}));

vi.mock('../../../hooks/useBudget', () => ({
  useBudget: () => ({
    budgets: [],
    getBudgetCategoryCandidates: vi.fn(() => []),
  }),
}));

vi.mock('../../../hooks/useBalances', () => ({
  useBalances: () => ({
    balances: [],
  }),
}));

vi.mock('../../../hooks/useMonthlySavingsPosition', () => ({
  useMonthlySavingsPosition: monthlySavingsSpy,
}));

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    PieChart: ({ children }: any) => <div>{children}</div>,
    Pie: ({ children }: any) => <div>{children}</div>,
    Cell: () => null,
  };
});

describe('AnalyseSection', () => {
  it('renders correctly and groups by category', () => {
    // We need to set the date to April 2026 for the mock data to match
    vi.setSystemTime(new Date(2026, 3, 1));

    render(
      <MemoryRouter>
        <AnalyseSection />
      </MemoryRouter>,
    );

    expect(screen.getByText(/analyse/i)).toBeInTheDocument();
    expect(monthlySavingsSpy).toHaveBeenCalledWith('2026-04', expect.any(Array));

    // Switch to 'Sorties' tab to see category details
    const sortiesBtn = screen.getByRole('button', { name: /sorties/i });
    fireEvent.click(sortiesBtn);

    expect(screen.getAllByText(/logement/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/alimentation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 150/).length).toBeGreaterThan(0); // Total sorties
  });
});
