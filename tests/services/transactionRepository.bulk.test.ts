import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  batchUpdateTransactions,
  batchRemoveTransactions,
} from '../../public/src/services/transactionRepository';
import { writeBatch } from 'firebase/firestore';

vi.mock('../../public/src/services/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'tester@example.com' } },
}));

// withRetry exécute simplement la fonction fournie dans les tests.
vi.mock('../../public/src/utils/withRetry', () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}` })),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  writeBatch: vi.fn(),
  Timestamp: class {},
}));

type BatchSpy = {
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
};

function makeBatch(): BatchSpy {
  return {
    update: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
}

describe('batchUpdateTransactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the same patch to every id in a single batch', async () => {
    const batch = makeBatch();
    (writeBatch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(batch);

    await batchUpdateTransactions(['a', 'b', 'c'], { categorie: 'Loisirs' });

    expect(batch.update).toHaveBeenCalledTimes(3);
    expect(batch.update).toHaveBeenCalledWith({ path: 'transactions/a' }, { categorie: 'Loisirs' });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('splits into chunks of 499', async () => {
    const batches = [makeBatch(), makeBatch()];
    let call = 0;
    (writeBatch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => batches[call++]);

    const ids = Array.from({ length: 600 }, (_, i) => `id-${i}`);
    await batchUpdateTransactions(ids, { libelle: 'X' });

    expect(batches[0]!.update).toHaveBeenCalledTimes(499);
    expect(batches[1]!.update).toHaveBeenCalledTimes(101);
    expect(batches[0]!.commit).toHaveBeenCalledTimes(1);
    expect(batches[1]!.commit).toHaveBeenCalledTimes(1);
  });
});

describe('batchRemoveTransactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes each transaction and writes a tombstone', async () => {
    const batch = makeBatch();
    (writeBatch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(batch);

    await batchRemoveTransactions(['a', 'b']);

    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.delete).toHaveBeenCalledWith({ path: 'transactions/a' });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'deleted_transactions/a' },
      expect.objectContaining({
        transactionId: 'a',
        deletedBy: 'tester@example.com',
        source: 'react_hook',
      }),
      { merge: true },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
