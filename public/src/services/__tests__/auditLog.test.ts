import { describe, it, expect, vi, beforeEach } from 'vitest';

const batch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
const getDocFromCacheMock = vi.fn();
const setDocMock = vi.fn().mockResolvedValue(undefined);
const authState: { currentUser: { email: string; uid: string } | null } = {
  currentUser: { email: 'invite@example.com', uid: 'uid-1' },
};

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ collection: name })),
  doc: vi.fn(() => ({ path: 'audit_log/new' })),
  getDocFromCache: (ref: unknown) => getDocFromCacheMock(ref),
  serverTimestamp: vi.fn(() => '__ts__'),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  writeBatch: vi.fn(() => batch),
}));

vi.mock('../../utils/withRetry', () => ({ withRetry: (fn: () => Promise<unknown>) => fn() }));
vi.mock('../firebase', () => ({
  db: {},
  get auth() {
    return authState;
  },
}));

import { audited, auditedMerge, recordAudit } from '../auditLog';
import type { DocumentReference } from 'firebase/firestore';

const txRef = { id: 't1', path: 'transactions/t1' } as unknown as DocumentReference;
const cached = (data: Record<string, unknown> | undefined) =>
  getDocFromCacheMock.mockResolvedValue({ data: () => data });

describe('audited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.currentUser = { email: 'invite@example.com', uid: 'uid-1' };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it("enregistre qui a changé quoi, après l'écriture métier", async () => {
    cached({ libelle: 'CB CARREFOUR', categorie: 'Divers' });
    const order: string[] = [];
    const write = vi.fn(async () => {
      order.push('write');
      return 'ok';
    });
    batch.commit.mockImplementationOnce(async () => {
      order.push('audit');
    });

    const result = await audited(
      { domain: 'transaction', ref: txRef, patch: { categorie: 'Courses' } },
      write,
    );

    expect(result).toBe('ok');
    expect(order).toEqual(['write', 'audit']);
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'audit_log/new' },
      {
        at: '__ts__',
        byEmail: 'invite@example.com',
        byUid: 'uid-1',
        domain: 'transaction',
        action: 'update',
        path: 'transactions/t1',
        docId: 't1',
        label: 'CB CARREFOUR',
        changes: [{ field: 'categorie', from: 'Divers', to: 'Courses' }],
      },
    );
  });

  it("n'enregistre rien si le patch ne change aucune valeur", async () => {
    cached({ libelle: 'CB CARREFOUR', pointe: true });
    await audited({ domain: 'transaction', ref: txRef, patch: { pointe: true } }, async () => {});
    expect(batch.set).not.toHaveBeenCalled();
  });

  it("n'enregistre rien si l'écriture métier échoue", async () => {
    cached({ libelle: 'CB CARREFOUR' });
    await expect(
      audited({ domain: 'transaction', ref: txRef, patch: { pointe: true } }, async () => {
        throw new Error('refusé');
      }),
    ).rejects.toThrow('refusé');
    expect(batch.set).not.toHaveBeenCalled();
  });

  it('document absent du cache : seule la nouvelle valeur est notée', async () => {
    getDocFromCacheMock.mockRejectedValue(new Error('absent du cache'));
    await audited({ domain: 'transaction', ref: txRef, patch: { pointe: true } }, async () => {});
    expect(batch.set.mock.calls[0]![1]).toMatchObject({
      label: '',
      changes: [{ field: 'pointe', to: true }],
    });
  });

  it('suppression : garde le libellé et les champs demandés du document supprimé', async () => {
    cached({ libelle: 'CB CARREFOUR', montant: -20, date: '2026-11-10', compte: 'LCL' });
    await audited(
      { domain: 'transaction', ref: txRef, action: 'delete', keep: ['date', 'montant'] },
      async () => {},
    );
    expect(batch.set.mock.calls[0]![1]).toMatchObject({
      action: 'delete',
      label: 'CB CARREFOUR',
      changes: [
        { field: 'date', from: '2026-11-10' },
        { field: 'montant', from: -20 },
      ],
    });
  });

  it("un échec du journal ne fait pas échouer l'action de l'utilisateur", async () => {
    cached({ libelle: 'CB CARREFOUR' });
    batch.commit.mockRejectedValueOnce(new Error('journal refusé'));
    await expect(
      audited({ domain: 'transaction', ref: txRef, patch: { pointe: true } }, async () => 'ok'),
    ).resolves.toBe('ok');
  });

  it("sans compte connecté, n'écrit pas de ligne", async () => {
    authState.currentUser = null;
    cached({ libelle: 'CB CARREFOUR' });
    await audited({ domain: 'transaction', ref: txRef, patch: { pointe: true } }, async () => {});
    expect(batch.set).not.toHaveBeenCalled();
  });
});

describe('recordAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.currentUser = { email: 'invite@example.com', uid: 'uid-1' };
  });

  it('enregistre une création avec son libellé, sans lire le cache', async () => {
    await recordAudit({ domain: 'transaction', ref: txRef, action: 'create', label: 'Marché' });
    expect(getDocFromCacheMock).not.toHaveBeenCalled();
    expect(batch.set.mock.calls[0]![1]).toMatchObject({
      action: 'create',
      label: 'Marché',
      changes: [],
    });
  });

  it('enregistre des changements explicites en lisant le libellé dans le cache', async () => {
    cached({ label: 'Netflix' });
    const ref = { id: 'r1', path: 'recurrences/r1' } as unknown as DocumentReference;
    await recordAudit({
      domain: 'recurrence',
      ref,
      changes: [{ field: 'skippedPeriod', to: '2026-11' }],
    });
    expect(batch.set.mock.calls[0]![1]).toMatchObject({
      domain: 'recurrence',
      action: 'update',
      label: 'Netflix',
      changes: [{ field: 'skippedPeriod', to: '2026-11' }],
    });
  });

  it('écrit plusieurs lignes par lots de 499', async () => {
    cached({ libelle: 'X' });
    const specs = Array.from({ length: 600 }, () => ({
      domain: 'transaction' as const,
      ref: txRef,
      patch: { pointe: true },
    }));
    await recordAudit(specs);
    expect(batch.set).toHaveBeenCalledTimes(600);
    expect(batch.commit).toHaveBeenCalledTimes(2);
  });
});

describe('auditedMerge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fusionne les données dans le document et consigne les champs modifiés', async () => {
    cached({ categorie: 'Courses', montant: 300 });
    const ref = { id: 'courses', path: 'budgets/courses' } as unknown as DocumentReference;
    const data = { categorie: 'Courses', montant: 350, updatedAt: '__ts__' };

    await auditedMerge('budget', ref, data, 'Courses (2026-11)');

    expect(setDocMock).toHaveBeenCalledWith(ref, data, { merge: true });
    expect(batch.set.mock.calls[0]![1]).toMatchObject({
      domain: 'budget',
      label: 'Courses (2026-11)',
      changes: [{ field: 'montant', from: 300, to: 350 }],
    });
  });
});
