import { describe, it, expect, vi, beforeEach } from 'vitest';

const batch = { delete: vi.fn(), set: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
const deleteDoc = vi.fn();
const setDoc = vi.fn();

vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: { email: 'owner@example.com' } } }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
    writeBatch: () => batch,
    deleteDoc: (...args: unknown[]) => deleteDoc(...args),
    setDoc: (...args: unknown[]) => setDoc(...args),
    serverTimestamp: () => 'ts',
  };
});

import { removeTransaction } from '../transactionRepository';

describe('removeTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('supprime et pose le tombstone dans un seul batch atomique', async () => {
    await removeTransaction('tx1');

    expect(batch.delete).toHaveBeenCalledWith({ path: 'transactions/tx1' });
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'deleted_transactions/tx1' },
      expect.objectContaining({ transactionId: 'tx1', deletedBy: 'owner@example.com' }),
      { merge: true },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
