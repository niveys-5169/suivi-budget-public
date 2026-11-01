import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TransactionsSection } from '../../public/src/components/TransactionsSection';
import { useTransactions } from '../../public/src/hooks/useTransactions';
import { useBalances } from '../../public/src/hooks/useBalances';
import { useBudget } from '../../public/src/hooks/useBudget';
import { useSyncTransactions } from '../../public/src/hooks/useSyncTransactions';

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
vi.mock('../../public/src/components/BalancesPanel', () => ({ BalancesPanel: () => null }));
vi.mock('../../public/src/components/TransactionFilters', () => ({
  TransactionFilters: () => null,
}));
vi.mock('../../public/src/components/TransactionFormModal', () => ({
  TransactionFormModal: () => null,
}));

const resetFilters = vi.fn();

const mockHook = (filteredTransactions: unknown[], search = '', loading = false) => {
  const now = new Date();
  (useTransactions as any).mockReturnValue({
    loading,
    transactions: [],
    filteredTransactions,
    filters: {
      search,
      compte: '',
      type: '',
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      pointe: '',
      categorie: '',
    },
    updateFilters: vi.fn(),
    resetFilters,
    togglePointe: vi.fn(),
    deleteTransaction: vi.fn(),
    saveTransaction: vi.fn(),
    pointAll: vi.fn(),
    unpointAll: vi.fn(),
    loadingMore: false,
    hasMore: false,
    loadMore: vi.fn(),
  });
};

const renderSection = () =>
  render(
    <MemoryRouter>
      <TransactionsSection />
    </MemoryRouter>,
  );

describe('TransactionsSection — liste vide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useBudget as any).mockReturnValue({ getBudgetCategoryCandidates: vi.fn(() => []) });
    (useBalances as any).mockReturnValue({ balances: [] });
    (useSyncTransactions as any).mockReturnValue({ sync: vi.fn(), isSyncing: false });
  });

  it('filtres actifs : message explicite et action de réinitialisation', () => {
    mockHook([], 'introuvable');
    renderSection();

    expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
    expect(screen.queryByTestId('tx-grouped')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(resetFilters).toHaveBeenCalledTimes(1);
  });

  it('mois courant sans filtre : message du mois et action d’ajout', () => {
    mockHook([]);
    renderSection();

    expect(screen.getByText('Aucune transaction ce mois-ci')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une transaction' })).toBeInTheDocument();
  });

  it('affiche la liste, sans état vide, dès qu’une transaction correspond', () => {
    mockHook([{ id: 't1', libelle: 'Café', montant: -3, date: '2026-10-01' }]);
    renderSection();

    expect(screen.getByTestId('tx-grouped')).toBeInTheDocument();
    expect(screen.queryByText(/Aucune transaction/)).toBeNull();
  });

  it('pas d’état vide tant que le premier chargement n’est pas terminé', () => {
    mockHook([], '', true);
    renderSection();

    expect(screen.queryByText(/Aucune transaction/)).toBeNull();
  });
});
