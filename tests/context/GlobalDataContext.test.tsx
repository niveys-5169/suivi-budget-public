import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { GlobalDataProvider, useGlobalData } from '../../public/src/context/GlobalDataContext';

// Mock Firebase minimally
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ id: path, path })),
  doc: vi.fn((db, col, id) => ({ id: id || col, path: id ? `${col}/${id}` : col })),
  onSnapshot: vi.fn((ref, callback) => {
    if (ref.path?.includes('account_balances')) {
      callback({
        docs: [{ id: 'b1', data: () => ({ compte: 'LCL', current_balance: 1000 }) }],
      });
    } else if (
      ref.path?.includes('recurring_expense_settings') ||
      ref.path?.includes('recurrences')
    ) {
      callback({ docs: [] });
    } else {
      callback({
        exists: () => true,
        data: () => ({ owners: ['Nicolas'] }),
      });
    }
    return () => {};
  }),
}));

vi.mock('../../public/src/services/firebase', () => ({
  db: { mock: true },
}));

const stableAuth = { user: { uid: 'u1' }, loading: false };
vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: vi.fn(() => stableAuth),
}));

// Mock balanceMapping to avoid importing many files
vi.mock('../../public/src/utils/balanceMapping', () => ({
  mapFirestoreBalance: vi.fn((doc) => ({ id: doc.id, ...doc.data() })),
}));

describe('GlobalDataContext Regression', () => {
  it('should provide consolidated data from Firestore', async () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <GlobalDataProvider>{children}</GlobalDataProvider>
    );

    const { result } = renderHook(() => useGlobalData(), { wrapper });

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
        expect(result.current.accountBalances).toHaveLength(1);
      },
      { timeout: 5000 },
    );

    expect(result.current.accountBalances[0]!.compte).toBe('LCL');
  });
});
