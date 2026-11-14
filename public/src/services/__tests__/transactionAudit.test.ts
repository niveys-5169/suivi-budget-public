import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditSpec } from '../auditLog';
import type { Transaction } from '../../types/banking.types';

const auditedMock = vi.fn((_specs: AuditSpec | AuditSpec[], write: () => Promise<unknown>) =>
  write(),
);
const recordAuditMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../auditLog', () => ({
  audited: (specs: AuditSpec | AuditSpec[], write: () => Promise<unknown>) =>
    auditedMock(specs, write),
  recordAudit: (specs: AuditSpec | AuditSpec[]) => recordAuditMock(specs),
}));

const batch = { update: vi.fn(), delete: vi.fn(), set: vi.fn(), commit: vi.fn() };
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ collection: name })),
  doc: vi.fn((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-id', path: 'transactions/new-id' }),
  serverTimestamp: vi.fn(() => 'ts'),
  writeBatch: vi.fn(() => batch),
  Timestamp: class {},
}));
vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: { email: 'a@example.com' } } }));
vi.mock('../../utils/withRetry', () => ({ withRetry: (fn: () => Promise<unknown>) => fn() }));

import {
  batchRemoveTransactions,
  batchSetPointe,
  batchUpdateTransactions,
  persistTransaction,
  removeTransaction,
  updatePointe,
} from '../transactionRepository';

const ref = (id: string) => ({ id, path: `transactions/${id}` });
const lastSpecs = () => auditedMock.mock.calls.at(-1)![0];

describe('journal des transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pointage', async () => {
    await updatePointe('t1', true);
    expect(lastSpecs()).toEqual({ domain: 'transaction', ref: ref('t1'), patch: { pointe: true } });
  });

  it('modification : le patch écrit est celui journalisé', async () => {
    await persistTransaction({ id: 't1', categorie: 'Courses' });
    expect(lastSpecs()).toEqual({
      domain: 'transaction',
      ref: ref('t1'),
      patch: { categorie: 'Courses' },
    });
  });

  it('création manuelle', async () => {
    await persistTransaction({ libelle: 'Marché', montant: -12, date: '2026-11-14' });
    expect(recordAuditMock).toHaveBeenCalledWith({
      domain: 'transaction',
      ref: { id: 'new-id', path: 'transactions/new-id' },
      action: 'create',
      label: 'Marché',
      changes: [
        { field: 'date', to: '2026-11-14' },
        { field: 'montant', to: -12 },
      ],
    });
  });

  it('suppression', async () => {
    await removeTransaction('t1');
    expect(lastSpecs()).toEqual({
      domain: 'transaction',
      ref: ref('t1'),
      action: 'delete',
      keep: ['date', 'montant', 'categorie'],
    });
  });

  it('modification en lot : une ligne par transaction', async () => {
    await batchUpdateTransactions(['a', 'b'], { categorie: 'Loisirs' });
    expect(lastSpecs()).toEqual([
      { domain: 'transaction', ref: ref('a'), patch: { categorie: 'Loisirs' } },
      { domain: 'transaction', ref: ref('b'), patch: { categorie: 'Loisirs' } },
    ]);
  });

  it('pointage en lot', async () => {
    await batchSetPointe([{ id: 'a' } as Transaction], false);
    expect(lastSpecs()).toEqual([
      { domain: 'transaction', ref: ref('a'), patch: { pointe: false } },
    ]);
  });

  it('suppression en lot', async () => {
    await batchRemoveTransactions(['a']);
    expect(lastSpecs()).toEqual([
      {
        domain: 'transaction',
        ref: ref('a'),
        action: 'delete',
        keep: ['date', 'montant', 'categorie'],
      },
    ]);
  });
});
