import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TransactionProvider, useTransactionContext } from '../TransactionContext';
import { filterTransactions } from '../../utils/filterTransactions';

// Objet stable : un nouvel utilisateur à chaque rendu relancerait le listener en boucle.
const mockAuth = { user: { uid: 'u1' }, loading: false };
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuth }));

const mockErrorHandler = { handle: vi.fn() };
vi.mock('../../hooks/useFirestoreErrorHandler', () => ({
  useFirestoreErrorHandler: () => mockErrorHandler,
}));

vi.mock('../../services/transactionRepository', () => ({
  buildTransactionQuery: vi.fn(() => ({})),
  normalizeTransaction: (raw: unknown) => raw,
  updatePointe: vi.fn(),
  removeTransaction: vi.fn(),
  persistTransaction: vi.fn(),
  batchSetPointe: vi.fn(),
  batchUpdateTransactions: vi.fn(),
  batchRemoveTransactions: vi.fn(),
  isRechargeDomicile: () => false,
  createEdfCreditForRecharge: vi.fn(),
  deleteAllEdfCredits: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  onSnapshot: (_q: unknown, next: (snap: unknown) => void) => {
    next({
      docs: [
        { id: 't1', data: () => ({ date: '2026-09-01', libelle: 'CB CARREFOUR', montant: -12 }) },
      ],
    });
    return () => {};
  },
}));

vi.mock('../../utils/filterTransactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/filterTransactions')>();
  return { filterTransactions: vi.fn(actual.filterTransactions) };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TransactionProvider>{children}</TransactionProvider>
);

describe('TransactionContext — recherche', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(filterTransactions).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('ne refiltre qu’après le debounce, pas à chaque frappe', () => {
    const { result } = renderHook(() => useTransactionContext(), { wrapper });
    const callsBefore = vi.mocked(filterTransactions).mock.calls.length;

    act(() => result.current.updateFilters({ search: 'c' }));
    act(() => result.current.updateFilters({ search: 'ca' }));
    act(() => result.current.updateFilters({ search: 'car' }));
    expect(vi.mocked(filterTransactions).mock.calls.length).toBe(callsBefore);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    const calls = vi.mocked(filterTransactions).mock.calls;
    expect(calls.length).toBe(callsBefore + 1);
    expect(calls.at(-1)?.[2]).toBe('car');
  });

  it('refiltre immédiatement quand un autre filtre change', () => {
    const { result } = renderHook(() => useTransactionContext(), { wrapper });
    const callsBefore = vi.mocked(filterTransactions).mock.calls.length;

    act(() => result.current.updateFilters({ pointe: 'non' }));
    expect(vi.mocked(filterTransactions).mock.calls.length).toBe(callsBefore + 1);
  });
});
