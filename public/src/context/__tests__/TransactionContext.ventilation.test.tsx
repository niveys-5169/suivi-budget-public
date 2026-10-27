import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { TransactionProvider, useTransactionContext } from '../TransactionContext';
import {
  updatePointe,
  persistTransaction,
  batchUpdateTransactions,
  removeTransaction,
} from '../../services/transactionRepository';

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
        {
          id: 'tx1',
          data: () => ({
            date: '2026-10-28',
            libelle: 'VIR SOLDE DE TOUT COMPTE',
            montant: 12000,
            compte: 'LCL',
            pointe: false,
            categorie: 'Indemnités de licenciement',
            ventilation: [{ montant: 2450, categorie: 'Salaire' }],
          }),
        },
      ],
    });
    return () => {};
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TransactionProvider>{children}</TransactionProvider>
);

describe('TransactionContext — ventilation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expose une ligne par part, de même total que la transaction', () => {
    const { result } = renderHook(() => useTransactionContext(), { wrapper });
    const lines = result.current.transactions;

    expect(lines.map((t) => [t.id, t.categorie, t.montant])).toEqual([
      ['tx1', 'Indemnités de licenciement', 9550],
      ['tx1#v1', 'Salaire', 2450],
    ]);
  });

  it('pointe, enregistre et supprime la transaction stockée depuis une part', async () => {
    const { result } = renderHook(() => useTransactionContext(), { wrapper });

    await act(() => result.current.togglePointe('tx1#v1', true));
    expect(updatePointe).toHaveBeenCalledWith('tx1', true);

    await act(() => result.current.saveTransaction({ id: 'tx1#v1', commentaire: 'x' }));
    expect(persistTransaction).toHaveBeenCalledWith({ id: 'tx1', commentaire: 'x' });

    await act(() => result.current.deleteTransaction('tx1#v1'));
    expect(removeTransaction).toHaveBeenCalledWith('tx1');
  });

  it('dédoublonne les parts d’une même transaction dans les actions groupées', async () => {
    const { result } = renderHook(() => useTransactionContext(), { wrapper });

    await act(() => result.current.bulkUpdate(['tx1', 'tx1#v1'], { pointe: true }));
    expect(batchUpdateTransactions).toHaveBeenCalledWith(['tx1'], { pointe: true });
  });
});
