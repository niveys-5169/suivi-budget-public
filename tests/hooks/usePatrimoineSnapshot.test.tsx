import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col-ref'),
  doc: vi.fn(() => 'doc-ref'),
  onSnapshot: vi.fn(() => () => {}),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  query: vi.fn((col) => col),
  orderBy: vi.fn(() => 'order'),
}));

vi.mock('../../public/src/services/firebase', () => ({
  db: { mock: true },
  dbPortfolio: { mock: true },
}));

vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { uid: 'u1' }, loading: false })),
}));

vi.mock('../../public/src/utils/balanceMapping', () => ({
  mapFirestoreBalance: vi.fn((doc) => ({ id: doc.id, ...doc.data() })),
}));

import { setDoc } from 'firebase/firestore';
import { usePatrimoine } from '../../public/src/hooks/usePatrimoine';

const mockSetDoc = setDoc as ReturnType<typeof vi.fn>;

describe('usePatrimoine — saveSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveSnapshot appelle setDoc avec les données par owner', async () => {
    const { result } = renderHook(() => usePatrimoine());

    const ownerData = {
      Nicolas: { courants: 5000, epargne: 10000, bourse: 2000, per: 1000, total: 18000 },
      Romane: { courants: 3000, epargne: 7000, bourse: 0, per: 500, total: 10500 },
    };

    await act(async () => {
      await result.current.saveSnapshot(ownerData);
    });

    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, docData] = mockSetDoc.mock.calls[0]!;
    expect(docData.owners).toEqual(ownerData);
    expect(typeof docData.monthKey).toBe('string');
    expect(docData.monthKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it('saveSnapshot ne sauvegarde pas si owners est vide', async () => {
    const { result } = renderHook(() => usePatrimoine());

    await act(async () => {
      await result.current.saveSnapshot({});
    });

    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('patrimoineSnapshots est initialisé comme tableau vide', async () => {
    const { result } = renderHook(() => usePatrimoine());

    await waitFor(() => {
      expect(Array.isArray(result.current.patrimoineSnapshots)).toBe(true);
    });
  });
});
