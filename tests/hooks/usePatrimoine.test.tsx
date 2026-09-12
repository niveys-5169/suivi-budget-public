import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

type SnapshotCallback = (snap: unknown) => void;
type ErrorCallback = (err: unknown) => void;

// Capture chaque abonnement onSnapshot (dans l'ordre d'enregistrement) pour
// pouvoir déclencher succès/erreurs manuellement et contrôler le timing.
let listeners: { onNext: SnapshotCallback; onError: ErrorCallback }[] = [];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, path) => ({ path })),
  doc: vi.fn((_db, col, id) => ({ path: id ? `${col}/${id}` : col })),
  query: vi.fn((col) => col),
  orderBy: vi.fn(() => 'order'),
  setDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  onSnapshot: vi.fn((_ref, onNext: SnapshotCallback, onError: ErrorCallback) => {
    listeners.push({ onNext, onError });
    return () => {};
  }),
}));

vi.mock('../../public/src/services/firebase', () => ({
  db: { mock: true },
  dbPortfolio: { mock: true },
}));

const stableAuth = { user: { uid: 'u1' }, loading: false };
vi.mock('../../public/src/hooks/useAuth', () => ({
  useAuth: vi.fn(() => stableAuth),
}));

vi.mock('../../public/src/utils/balanceMapping', () => ({
  mapFirestoreBalance: vi.fn((doc) => ({ id: doc.id, ...doc.data() })),
}));

import { usePatrimoine } from '../../public/src/hooks/usePatrimoine';

const emptySnap = { docs: [], exists: () => false };

describe('usePatrimoine — loading', () => {
  beforeEach(() => {
    listeners = [];
    vi.clearAllMocks();
  });

  it('loading est true synchroniquement au montage, avant tout snapshot', () => {
    const { result } = renderHook(() => usePatrimoine());

    expect(result.current.loading).toBe(true);
    expect(listeners).toHaveLength(5);
  });

  it('loading ne passe à false que lorsque les 5 listeners ont répondu', async () => {
    const { result } = renderHook(() => usePatrimoine());

    expect(listeners).toHaveLength(5);

    // 4 des 5 sources répondent : loading doit rester true.
    act(() => {
      listeners[0]!.onNext(emptySnap);
      listeners[1]!.onNext(emptySnap);
      listeners[2]!.onNext(emptySnap);
      listeners[3]!.onNext(emptySnap);
    });
    expect(result.current.loading).toBe(true);

    // La 5e source répond : loading doit passer à false.
    act(() => {
      listeners[4]!.onNext(emptySnap);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('une erreur de listener compte aussi comme réponse pour lever loading', async () => {
    const { result } = renderHook(() => usePatrimoine());

    expect(listeners).toHaveLength(5);

    act(() => {
      listeners[0]!.onError(new Error('boom'));
      listeners[1]!.onNext(emptySnap);
      listeners[2]!.onNext(emptySnap);
      listeners[3]!.onNext(emptySnap);
      listeners[4]!.onNext(emptySnap);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
