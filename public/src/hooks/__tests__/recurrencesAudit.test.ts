import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditSpec } from '../../services/auditLog';
import type { Transaction } from '../../types/banking.types';

const auditedMock = vi.fn((_specs: AuditSpec, write: () => Promise<unknown>) => write());
vi.mock('../../services/auditLog', () => ({
  audited: (specs: AuditSpec, write: () => Promise<unknown>) => auditedMock(specs, write),
}));

const getDocMock = vi.fn();
const setDocMock = vi.fn().mockResolvedValue(undefined);
const updateDocMock = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) =>
    args.length === 1
      ? { id: 'new', path: 'recurrences/new' }
      : { id: args[2], path: `recurrences/${args[2]}` },
  ),
  collection: vi.fn(() => 'col'),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  deleteField: () => '__del__',
  serverTimestamp: () => '__ts__',
  arrayUnion: (...v: unknown[]) => ({ union: v }),
  arrayRemove: (...v: unknown[]) => ({ remove: v }),
}));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../utils/withRetry', () => ({ withRetry: (fn: () => Promise<unknown>) => fn() }));

import {
  addRecurrenceAlias,
  approveRecurrenceMatch,
  createRecurrenceFromTransaction,
  rejectRecurrenceMatch,
  removeRecurrence,
  setRecurrenceActive,
  skipRecurrencePeriod,
  unapproveRecurrenceMonth,
  unlinkRecurrenceTx,
  unskipRecurrencePeriod,
  updateRecurrence,
} from '../recurrencesService';

const ref = { id: 'r1', path: 'recurrences/r1' };
const tx = {
  id: 'tx-1',
  date: '2026-11-05',
  libelle: 'Netflix',
  categorie: 'Abonnement',
  montant: -13.99,
} as Transaction;
const wrapped = () => auditedMock.mock.calls.at(-1)![0];
const recorded = wrapped;

describe('journal des récurrences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocMock.mockResolvedValue({ data: () => undefined });
  });

  it('création', async () => {
    await createRecurrenceFromTransaction(tx);
    expect(recorded()).toEqual({
      domain: 'recurrence',
      ref: { id: 'new', path: 'recurrences/new' },
      action: 'create',
      label: 'Netflix',
      changes: [{ field: 'expectedAmount', to: -13.99 }],
    });
  });

  it("l'écriture métier est exécutée par audited, pas avant", async () => {
    auditedMock.mockImplementationOnce(() => Promise.resolve(undefined));
    await skipRecurrencePeriod('r1', '2026-11');
    expect(updateDocMock).not.toHaveBeenCalled();

    auditedMock.mockImplementationOnce(() => Promise.resolve(undefined));
    await createRecurrenceFromTransaction(tx);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('modification et pause : patch comparé à l’état précédent', async () => {
    await updateRecurrence('r1', { expectedAmount: -15 });
    expect(wrapped()).toEqual({ domain: 'recurrence', ref, patch: { expectedAmount: -15 } });
    await setRecurrenceActive('r1', false);
    expect(wrapped()).toEqual({ domain: 'recurrence', ref, patch: { active: false } });
  });

  it('suppression', async () => {
    await removeRecurrence('r1');
    expect(wrapped()).toEqual({
      domain: 'recurrence',
      ref,
      action: 'delete',
      keep: ['expectedAmount', 'category'],
    });
  });

  it('mois ignoré puis rétabli', async () => {
    await skipRecurrencePeriod('r1', '2026-11');
    expect(recorded().changes).toEqual([{ field: 'skippedPeriod', to: '2026-11' }]);
    await unskipRecurrencePeriod('r1', '2026-11');
    expect(recorded().changes).toEqual([{ field: 'skippedPeriod', from: '2026-11' }]);
  });

  it('liaison, déliaison, désapprobation, refus', async () => {
    await approveRecurrenceMatch('r1', '2026-11', tx);
    expect(recorded()).toEqual({
      domain: 'recurrence',
      ref,
      changes: [{ field: 'linkedTx', to: '2026-11 · Netflix' }],
    });

    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: { '2026-11': { txId: 'tx-1', amount: -13.99, date: '2026-11-05' } },
      }),
    });
    await unlinkRecurrenceTx('r1', 'tx-1');
    expect(recorded().changes).toEqual([{ field: 'linkedTx', from: '2026-11' }]);

    await unapproveRecurrenceMonth('r1', '2026-11');
    expect(recorded().changes).toEqual([{ field: 'linkedTx', from: '2026-11' }]);

    await rejectRecurrenceMatch('r1', 'tx-9');
    expect(recorded().changes).toEqual([{ field: 'rejectedTx', to: 'tx-9' }]);
  });

  it('rien à journaliser : liaison déjà faite, déliaison sans lien, alias appris', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: { '2026-11': { txId: 'tx-1', amount: -13.99, date: '2026-11-05' } },
      }),
    });
    await approveRecurrenceMatch('r1', '2026-11', tx);
    await unlinkRecurrenceTx('r1', 'autre');
    await addRecurrenceAlias('r1', 'Netflix');
    expect(auditedMock).not.toHaveBeenCalled();
  });
});
