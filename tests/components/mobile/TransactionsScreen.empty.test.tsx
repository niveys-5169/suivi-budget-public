import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionsScreen } from '../../../public/src/mobile/screens/TransactionsScreen';

const resetFilters = vi.hoisted(() => vi.fn());
const filters = vi.hoisted(() => ({
  current: {
    search: '',
    compte: '',
    type: '',
    year: '2020',
    month: '01',
    pointe: '',
    categorie: '',
  } as Record<string, string>,
}));

vi.mock('../../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    filteredTransactions: [],
    filters: filters.current,
    updateFilters: vi.fn(),
    resetFilters,
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    togglePointe: vi.fn(),
    pointAll: vi.fn(),
    unpointAll: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
    bulkSetPointe: vi.fn(),
    hasMore: false,
    loadMore: vi.fn(),
    loadingMore: false,
  }),
}));
vi.mock('../../../public/src/hooks/useFormOptions', () => ({
  useFormOptions: () => ({ categories: [], accounts: [] }),
}));
vi.mock('../../../public/src/hooks/useSyncTransactions', () => ({
  useSyncTransactions: () => ({ sync: vi.fn(), isSyncing: false }),
}));
vi.mock('../../../public/src/hooks/useRecurrences', () => ({
  useRecurrences: () => ({
    mappings: { linkedTxToRecurrence: {}, candidateTxToRecurrence: {} },
    ignoreTxMatch: vi.fn(),
    link: vi.fn(),
  }),
}));
vi.mock('../../../public/src/components/PullToRefreshWrapper', () => ({
  PullToRefreshWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../public/src/components/TransactionFormModal', () => ({
  TransactionFormModal: () => null,
}));
vi.mock('../../../public/src/mobile/components/MTransactionFilterModal', () => ({
  MTransactionFilterModal: () => null,
}));

describe('TransactionsScreen mobile — liste vide', () => {
  beforeEach(() => resetFilters.mockClear());

  it('filtres actifs : message explicite et réinitialisation en un geste', () => {
    render(<TransactionsScreen />);

    expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(resetFilters).toHaveBeenCalledTimes(1);
  });
});
