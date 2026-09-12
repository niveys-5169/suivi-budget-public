import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainApp } from '../MainApp';
import React from 'react';

// Mock everything including providers to isolate MainApp
vi.mock('../context/AppStateContext', () => ({
  AppStateProvider: ({ children }: any) => <div data-testid="app-state-provider">{children}</div>,
  useAppState: () => ({}),
}));

vi.mock('../context/TransactionContext', () => ({
  TransactionProvider: ({ children }: any) => (
    <div data-testid="transaction-provider">{children}</div>
  ),
  useTransactionContext: () => ({}),
}));

vi.mock('../context/BudgetContext', () => ({
  BudgetProvider: ({ children }: any) => <div data-testid="budget-provider">{children}</div>,
  useBudgetContext: () => ({}),
}));

// Mock sections
vi.mock('../components/DashboardSection', () => ({
  DashboardSection: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('../components/TransactionsSection', () => ({
  TransactionsSection: () => <div data-testid="transactions">Transactions</div>,
}));
vi.mock('../components/budgets-v2/BudgetsV2Section', () => ({
  BudgetsV2Section: () => <div data-testid="budgets">Budgets</div>,
}));
vi.mock('../components/PatrimoineSection', () => ({
  PatrimoineSection: () => <div data-testid="patrimoine">Patrimoine</div>,
}));
vi.mock('../components/analyse/AnalyseSection', () => ({
  AnalyseSection: () => <div data-testid="analyse">Analyse</div>,
}));
vi.mock('../components/FinanceQASection', () => ({
  FinanceQASection: () => <div data-testid="qa">QA</div>,
}));
vi.mock('../components/AdvancedSettings', () => ({
  AdvancedSettings: () => <div data-testid="advanced">Advanced</div>,
}));

// Mock feature flags
vi.mock('../lib/featureFlags', () => ({
  FLAGS: {
    BOTTOMNAV_V2: true,
    ANALYSE_PAGE: true,
    BUDGET_BANKIN: true,
  },
}));

describe('App Navigation', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('renders correctly', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MainApp />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });
});
