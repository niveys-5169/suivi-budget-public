import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const prev = new Date();
prev.setDate(1);
prev.setMonth(prev.getMonth() - 1);
const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

vi.mock('../useBudget', () => ({
  useBudget: () => ({ budgets: [{ id: 'b1', categorie: 'Courses', montant: 100 }] }),
}));
vi.mock('../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: [{ id: 't1', categorie: 'Courses', montant: -150, date: `${prevKey}-10` }],
  }),
}));
vi.mock('../../context/GlobalDataContext', () => ({
  useGlobalData: () => ({ recurrences: [] }),
}));

describe('useAlerts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('le point rouge disparaît après markAllRead', async () => {
    const { useAlerts } = await import('../useAlerts');
    const { result } = renderHook(() => useAlerts());
    expect(result.current.unreadErrorCount).toBe(1);
    act(() => result.current.markAllRead());
    expect(result.current.unreadErrorCount).toBe(0);
  });
});
