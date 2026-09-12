import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Transaction } from '../../../../types/banking.types';

const togglePointe = vi.fn();

const tx: Partial<Transaction> = {
  id: 'tx-1',
  libelle: 'Café',
  montant: -3.5,
  date: '2026-08-18',
  categorie: 'Restaurant',
  compte: 'Courant',
  pointe: false,
};

vi.mock('../../../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: [tx],
    filteredTransactions: [tx],
    filters: { year: '2026', month: '08', search: '' },
    updateFilters: vi.fn(),
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    togglePointe,
    loading: false,
  }),
}));

vi.mock('../../../../hooks/useRecurrences', () => ({
  useRecurrences: () => ({
    mappings: { linkedTxToRecurrence: {}, candidateTxToRecurrence: {} },
    ignoredTxIds: [],
    ignoreTxMatch: vi.fn(),
    link: vi.fn(),
  }),
}));

vi.mock('../../../../context/AppStateContext', () => ({
  useAppState: () => ({ setMonthKey: vi.fn() }),
}));

vi.mock('../../shared/MonthNavigator', () => ({ MonthNavigator: () => null }));

vi.mock('../AurumTransactionDetail', () => ({
  AurumTransactionDetail: () => <div data-testid="detail-modal" />,
}));

import { AurumTransactionsPage } from '../AurumTransactionsPage';

describe('AurumTransactionsPage — pointage rapide', () => {
  beforeEach(() => togglePointe.mockClear());

  it('toggles pointe from the always-visible pill without opening the detail modal', () => {
    render(<AurumTransactionsPage />);

    const pill = screen.getByRole('button', { name: 'Pointer' });
    fireEvent.click(pill);

    expect(togglePointe).toHaveBeenCalledWith('tx-1', true);
    expect(screen.queryByTestId('detail-modal')).not.toBeInTheDocument();
  });
});
