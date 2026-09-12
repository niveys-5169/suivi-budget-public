import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AurumTransactionsPage } from '../../../../public/src/components/dashboard/v2/AurumTransactionsPage';
import { TransactionContext } from '../../../../public/src/context/TransactionContext';
import { AppStateProvider } from '../../../../public/src/context/AppStateContext';
import React from 'react';

const mockIgnoreTxMatch = vi.fn();
const mockLink = vi.fn();
let mockLinkedTxToRecurrence: any = {};
let mockCandidateTxToRecurrence: any = {};
let mockIgnoredTxIds: string[] = [];

vi.mock('../../../../public/src/hooks/useRecurrences', () => ({
  useRecurrences: () => ({
    mappings: {
      linkedTxToRecurrence: mockLinkedTxToRecurrence,
      candidateTxToRecurrence: mockCandidateTxToRecurrence,
    },
    ignoredTxIds: mockIgnoredTxIds,
    ignoreTxMatch: mockIgnoreTxMatch,
    link: mockLink,
  }),
}));

const mockTransactions = [
  {
    id: '1',
    libelle: 'Test Transaction',
    montant: -50,
    date: '2026-05-10T10:00:00Z',
    categorie: 'Alimentation',
    compte: 'Compte Courant',
    pointe: false,
  },
  {
    id: '2',
    libelle: 'Salary',
    montant: 2000,
    date: '2026-05-09T10:00:00Z',
    categorie: 'Salaire',
    compte: 'Compte Courant',
    pointe: true,
  },
];

const mockContextValue = {
  filteredTransactions: mockTransactions,
  filters: { search: '' },
  updateFilters: vi.fn(),
  saveTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  loading: false,
  transactions: mockTransactions,
  setTransactions: vi.fn(),
  addTransaction: vi.fn(),
  refreshTransactions: vi.fn(),
};

describe('AurumTransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkedTxToRecurrence = {};
    mockCandidateTxToRecurrence = {};
    mockIgnoredTxIds = [];
  });

  it('renders correctly with transactions grouped by date', () => {
    render(
      <AppStateProvider>
        <TransactionContext.Provider value={mockContextValue as any}>
          <AurumTransactionsPage />
        </TransactionContext.Provider>
      </AppStateProvider>,
    );

    expect(screen.getByText('Flux Bancaires')).toBeDefined();
    expect(screen.getByText('Test Transaction')).toBeDefined();
    expect(screen.getByText('Salary')).toBeDefined();

    // Check if dates are rendered
    expect(screen.getByText(/dimanche 10 mai/i)).toBeDefined();
    expect(screen.getByText(/samedi 9 mai/i)).toBeDefined();
  });

  it('shows loading state', () => {
    render(
      <AppStateProvider>
        <TransactionContext.Provider value={{ ...mockContextValue, loading: true } as any}>
          <AurumTransactionsPage />
        </TransactionContext.Provider>
      </AppStateProvider>,
    );

    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeDefined();
  });

  it('renders search island', () => {
    render(
      <AppStateProvider>
        <TransactionContext.Provider value={mockContextValue as any}>
          <AurumTransactionsPage />
        </TransactionContext.Provider>
      </AppStateProvider>,
    );

    expect(screen.getByPlaceholderText('Rechercher une transaction, un montant...')).toBeDefined();
  });

  it('renders a persistent badge for a linked transaction', () => {
    mockLinkedTxToRecurrence = {
      '1': { id: 'r1', label: 'Loyer mensuel' },
    };

    render(
      <AppStateProvider>
        <TransactionContext.Provider value={mockContextValue as any}>
          <AurumTransactionsPage />
        </TransactionContext.Provider>
      </AppStateProvider>,
    );

    expect(screen.getByText(/Loyer mensuel/i)).toBeDefined();
  });

  it('renders a suggestion banner for a candidate transaction and handles interaction', () => {
    mockCandidateTxToRecurrence = {
      '1': { id: 'r2', label: 'Abonnement Netflix', dayOfMonth: 10 },
    };

    render(
      <AppStateProvider>
        <TransactionContext.Provider value={mockContextValue as any}>
          <AurumTransactionsPage />
        </TransactionContext.Provider>
      </AppStateProvider>,
    );

    expect(screen.getByText(/Correspondance détectée avec la récurrence/i)).toBeDefined();
    expect(screen.getByText(/Abonnement Netflix/i)).toBeDefined();

    // Link & Point interaction
    const linkBtn = screen.getByRole('button', { name: /Lier & Pointer/i });
    fireEvent.click(linkBtn);
    expect(mockLink).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Abonnement Netflix' }),
      expect.objectContaining({ id: '1' }),
    );

    // Ignore interaction
    const ignoreBtn = screen.getByRole('button', { name: /Ignorer/i });
    fireEvent.click(ignoreBtn);
    expect(mockIgnoreTxMatch).toHaveBeenCalledWith('1');
  });
});
