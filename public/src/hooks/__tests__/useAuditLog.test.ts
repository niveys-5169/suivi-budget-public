import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Listener = {
  next: (snap: { docs: unknown[] }) => void;
  error: (err: Error) => void;
};
let listener: Listener;
const queryMock = vi.fn((...parts: unknown[]) => parts);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ collection: name })),
  limit: vi.fn((n) => ({ limit: n })),
  orderBy: vi.fn((field, dir) => ({ orderBy: [field, dir] })),
  where: vi.fn((field, op, value) => ({ where: [field, op, value] })),
  query: (...parts: unknown[]) => queryMock(...parts),
  onSnapshot: vi.fn((_q, next: Listener['next'], error: Listener['error']) => {
    listener = { next, error };
    return () => {};
  }),
}));
vi.mock('../../services/firebase', () => ({ db: {} }));

import { useAuditLog, useDocumentAudit } from '../useAuditLog';

const row = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => ({
    byEmail: 'invite@example.com',
    domain: 'transaction',
    action: 'update',
    path: 'transactions/t1',
    docId: 't1',
    label: 'CB CARREFOUR',
    changes: [],
    ...data,
  }),
});
const at = (day: number) => ({ toDate: () => new Date(2026, 10, day) });

describe('useAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('écoute les `max` dernières lignes, de la plus récente à la plus ancienne', () => {
    const { result } = renderHook(() => useAuditLog(50));
    expect(queryMock).toHaveBeenCalledWith(
      { collection: 'audit_log' },
      { orderBy: ['at', 'desc'] },
      { limit: 50 },
    );
    expect(result.current.loading).toBe(true);

    act(() =>
      listener.next({
        docs: [row('old', { at: at(10) }), row('pending', {}), row('new', { at: at(14) })],
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.entries.map((e) => e.id)).toEqual(['pending', 'new', 'old']);
  });

  it('écarte les lignes et les changements mal formés', () => {
    const { result } = renderHook(() => useAuditLog(50));
    act(() =>
      listener.next({
        docs: [
          row('ok', {
            at: at(14),
            changes: [{ field: 'categorie', to: 'Courses' }, null, 'texte', { field: 3 }, {}],
          }),
          row('domaine', { domain: 'patrimoine' }),
          row('action', { action: 'purge' }),
          row('sans-domaine', { domain: undefined }),
          row('changes', { changes: 'tout' }),
        ],
      }),
    );
    // `changes` sans date (pas encore horodatée) passe en tête.
    expect(result.current.entries.map((e) => e.id)).toEqual(['changes', 'ok']);
    expect(result.current.entries[0]!.changes).toEqual([]);
    expect(result.current.entries[1]!.changes).toEqual([{ field: 'categorie', to: 'Courses' }]);
  });

  it("une erreur de lecture n'est pas un journal vide", () => {
    const { result } = renderHook(() => useAuditLog(50));
    act(() => listener.error(new Error('permission-denied')));
    expect(result.current).toEqual({ entries: [], loading: false, error: true });
  });
});

describe('useDocumentAudit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lignes du document, mal formées écartées', () => {
    const { result } = renderHook(() => useDocumentAudit('transactions/t1'));
    expect(queryMock).toHaveBeenCalledWith(
      { collection: 'audit_log' },
      { where: ['path', '==', 'transactions/t1'] },
    );
    act(() =>
      listener.next({
        docs: [row('ok', { at: at(14) }), row('inconnu', { action: 'purge' })],
      }),
    );
    expect(result.current.map((e) => e.id)).toEqual(['ok']);
  });
});
