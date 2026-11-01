import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProjectionParams } from '../useProjectionParams';
import { createDefaultProjectionParams } from '../../utils/projection/defaults';
import type { ProjectionParams } from '../../types/banking.types';

type SnapNext = (snap: { exists: () => boolean; data: () => unknown }) => void;
type SnapError = (err: Error) => void;

const h = vi.hoisted(() => ({
  next: null as null | ((snap: { exists: () => boolean; data: () => unknown }) => void),
  error: null as null | ((err: Error) => void),
  setDoc: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  onSnapshot: (_ref: unknown, next: SnapNext, error: SnapError) => {
    h.next = next;
    h.error = error;
    return () => {};
  },
  setDoc: (...args: unknown[]) => h.setDoc(...args),
}));

const emit = (data: unknown | null) =>
  act(() => h.next!({ exists: () => data !== null, data: () => data }));

describe('useProjectionParams', () => {
  beforeEach(() => {
    h.setDoc.mockReset();
    h.setDoc.mockResolvedValue(undefined);
  });

  it('charge puis retourne les défauts si le document est absent', () => {
    const { result } = renderHook(() => useProjectionParams());
    expect(result.current.loading).toBe(true);
    emit(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.exists).toBe(false);
    expect(result.current.params.version).toBe(1);
    expect(result.current.params.scenarios).toHaveLength(1);
  });

  it('retourne les défauts si le document n’a pas version 1', () => {
    const { result } = renderHook(() => useProjectionParams());
    emit({ version: 2, macro: { inflation: 0.5, rendementCapital: 0, rendementPatrimoine: 0 } });
    expect(result.current.exists).toBe(false);
    expect(result.current.params.macro.inflation).toBe(0.02);
  });

  it('fusionne un document partiel avec les défauts (niveau 1)', () => {
    const { result } = renderHook(() => useProjectionParams());
    const macro = { inflation: 0.03, rendementCapital: 0.04, rendementPatrimoine: 0.05 };
    emit({ version: 1, macro });
    expect(result.current.exists).toBe(true);
    expect(result.current.params.macro).toEqual(macro);
    expect(result.current.params.personnes).toHaveLength(2);
    expect(result.current.params.depenses.credits).toEqual([]);
    expect(result.current.params.scenarioAfficheId).toBe('s1');
  });

  it('expose l’erreur du listener', () => {
    const { result } = renderHook(() => useProjectionParams());
    act(() => h.error!(new Error('permission-denied')));
    expect(result.current.error).toBe('permission-denied');
    expect(result.current.loading).toBe(false);
  });

  it('save remplace le document (sans merge) et retire les undefined récursivement', async () => {
    const { result } = renderHook(() => useProjectionParams());
    emit(null);
    const base = createDefaultProjectionParams(new Date(2026, 0, 1));
    const next = {
      ...base,
      personnes: [{ id: 'p1', prenom: 'A', dateNaissance: undefined }],
      depenses: {
        ...base.depenses,
        credits: [
          {
            id: 'c1',
            libelle: 'Crédit',
            mode: 'manuel',
            finManuelle: undefined,
            remboursementAnticipe: { mois: '2030-01', frais: undefined },
          },
        ],
      },
    } as ProjectionParams;

    await act(() => result.current.save(next));

    expect(h.setDoc).toHaveBeenCalledTimes(1);
    const [ref, written, options] = h.setDoc.mock.calls[0]!;
    expect(ref).toEqual({ path: 'metadata/projection_params' });
    expect(options).toBeUndefined();
    const w = written as ProjectionParams;
    expect(w.personnes[0]).toEqual({ id: 'p1', prenom: 'A' });
    expect('dateNaissance' in w.personnes[0]!).toBe(false);
    const credit = w.depenses.credits[0]!;
    expect('finManuelle' in credit).toBe(false);
    expect(credit.remboursementAnticipe).toEqual({ mois: '2030-01' });
  });
});
