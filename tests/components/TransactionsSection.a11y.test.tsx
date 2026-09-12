import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { TransactionsSection } from '../../public/src/components/TransactionsSection';
import { useTransactions } from '../../public/src/hooks/useTransactions';
import { useBalances } from '../../public/src/hooks/useBalances';
import { useBudget } from '../../public/src/hooks/useBudget';
import { useSyncTransactions } from '../../public/src/hooks/useSyncTransactions';

expect.extend(toHaveNoViolations);

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

vi.mock('../../public/src/hooks/useTransactions', () => ({ useTransactions: vi.fn() }));
vi.mock('../../public/src/hooks/useBalances', () => ({ useBalances: vi.fn() }));
vi.mock('../../public/src/hooks/useBudget', () => ({ useBudget: vi.fn() }));
vi.mock('../../public/src/hooks/useSyncTransactions', () => ({ useSyncTransactions: vi.fn() }));

vi.mock('../../public/src/components/transactions/TransactionGroupedList', () => ({
  TransactionGroupedList: () => <div data-testid="tx-grouped" />,
}));
vi.mock('../../public/src/components/PullToRefreshWrapper', () => ({
  PullToRefreshWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../public/src/components/BalancesPanel', () => ({
  BalancesPanel: () => <div data-testid="balances" />,
}));
vi.mock('../../public/src/components/TransactionFormModal', () => ({
  TransactionFormModal: () => null,
}));

describe('TransactionsSection — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTransactions as any).mockReturnValue({
      transactions: [],
      filteredTransactions: [],
      filters: {
        search: '',
        compte: '',
        type: '',
        year: '2026',
        month: '04',
        pointe: '',
        categorie: '',
      },
      updateFilters: vi.fn(),
      resetFilters: vi.fn(),
      togglePointe: vi.fn(),
      deleteTransaction: vi.fn(),
      saveTransaction: vi.fn(),
      pointAll: vi.fn(),
      unpointAll: vi.fn(),
      loading: false,
      loadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
    });
    (useBudget as any).mockReturnValue({ getBudgetCategoryCandidates: vi.fn(() => []) });
    (useBalances as any).mockReturnValue({ balances: [] });
    (useSyncTransactions as any).mockReturnValue({ sync: vi.fn(), isSyncing: false });
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <TransactionsSection />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
