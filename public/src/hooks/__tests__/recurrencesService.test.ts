import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Firestore mocks ───────────────────────────────────────────────────────────
const setDocMock = vi.fn().mockResolvedValue(undefined);
const updateDocMock = vi.fn().mockResolvedValue(undefined);
const deleteDocMock = vi.fn().mockResolvedValue(undefined);
const getDocMock = vi.fn().mockResolvedValue({ data: () => undefined });

const fakeDocRef = { id: 'new-auto-id' };
const docMock = vi.fn().mockReturnValue(fakeDocRef);
const collectionMock = vi.fn().mockReturnValue('col-ref');
const deleteFieldMock = vi.fn().mockReturnValue('__deleteField__');
const serverTimestampMock = vi.fn().mockReturnValue('__serverTimestamp__');
const arrayUnionMock = vi.fn((...vals: unknown[]) => ({ __arrayUnion__: vals }));
const arrayRemoveMock = vi.fn((...vals: unknown[]) => ({ __arrayRemove__: vals }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => docMock(...args),
  collection: (...args: unknown[]) => collectionMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  deleteField: () => deleteFieldMock(),
  serverTimestamp: () => serverTimestampMock(),
  arrayUnion: (...args: unknown[]) => arrayUnionMock(...args),
  arrayRemove: (...args: unknown[]) => arrayRemoveMock(...args),
}));

vi.mock('../../services/firebase', () => ({ db: {} }));

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  createRecurrenceFromTransaction,
  approveRecurrenceMatch,
  unapproveRecurrenceMonth,
  unlinkRecurrenceTx,
  removeRecurrence,
  setRecurrenceActive,
  updateRecurrence,
  skipRecurrencePeriod,
  unskipRecurrencePeriod,
  addRecurrenceAlias,
} from '../recurrencesService';
import type { Transaction } from '../../types/banking.types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-06-15',
  libelle: 'Netflix',
  categorie: 'Abonnement',
  montant: -13.99,
  compte: 'LCL',
  pointe: false,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('createRecurrenceFromTransaction', () => {
  beforeEach(() => {
    setDocMock.mockClear();
    collectionMock.mockClear();
    docMock.mockClear();
  });

  it('calls setDoc with derived label, category, amount and anchorDate (no dayOfMonth)', async () => {
    await createRecurrenceFromTransaction(makeTx());

    expect(setDocMock).toHaveBeenCalledOnce();
    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload.label).toBe('Netflix');
    expect(payload.category).toBe('Abonnement');
    expect(payload.expectedAmount).toBe(-13.99);
    expect(payload.dayOfMonth).toBeUndefined();
    expect(payload.anchorDate).toBe('2026-06-15');
    expect(payload.aliases).toEqual(['netflix']);
    expect(payload.source).toBe('manual');
    expect(payload.active).toBe(true);
    expect(payload.createdAt).toBe('__serverTimestamp__');
  });

  it('auto-links the source transaction for its month when tx has a real id', async () => {
    await createRecurrenceFromTransaction(makeTx({ id: 'tx-7', date: '2026-06-15' }));
    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload.approvedMonths['2026-06']).toMatchObject({
      txId: 'tx-7',
      amount: -13.99,
      date: '2026-06-15',
      entries: [{ txId: 'tx-7', amount: -13.99, date: '2026-06-15' }],
    });
    expect(typeof payload.approvedMonths['2026-06'].approvedAt).toBe('number');
  });

  it('derives the month key from a date with T-suffix', async () => {
    await createRecurrenceFromTransaction(makeTx({ id: 'tx-8', date: '2026-03-22T10:30:00Z' }));
    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload.approvedMonths['2026-03']).toMatchObject({ txId: 'tx-8', date: '2026-03-22' });
  });

  it('does NOT auto-link when tx id is missing or "temp"', async () => {
    await createRecurrenceFromTransaction(makeTx({ id: 'temp' }));
    expect(setDocMock.mock.calls[0]![1].approvedMonths).toEqual({});

    setDocMock.mockClear();
    await createRecurrenceFromTransaction(makeTx({ id: undefined as unknown as string }));
    expect(setDocMock.mock.calls[0]![1].approvedMonths).toEqual({});
  });

  it('strips the T-suffix from the date when deriving anchorDate', async () => {
    await createRecurrenceFromTransaction(makeTx({ date: '2026-06-22T10:30:00Z' }));
    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload.anchorDate).toBe('2026-06-22');
  });

  it('returns the auto-generated doc id', async () => {
    const id = await createRecurrenceFromTransaction(makeTx());
    expect(id).toBe('new-auto-id');
  });

  it('throws and logs on Firestore error', async () => {
    setDocMock.mockRejectedValueOnce(new Error('network'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createRecurrenceFromTransaction(makeTx())).rejects.toThrow('network');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('approveRecurrenceMatch', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    getDocMock.mockClear();
    getDocMock.mockResolvedValue({ data: () => undefined });
  });

  it('calls updateDoc with dot-notation key, tx payload and entries', async () => {
    const tx = makeTx({ id: 'tx-99', montant: -13.5, date: '2026-06-14' });
    await approveRecurrenceMatch('rec-1', '2026-06', tx);

    expect(updateDocMock).toHaveBeenCalledOnce();
    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06']).toMatchObject({
      txId: 'tx-99',
      amount: -13.5,
      date: '2026-06-14',
      entries: [{ txId: 'tx-99', amount: -13.5, date: '2026-06-14' }],
    });
    expect(typeof update['approvedMonths.2026-06'].approvedAt).toBe('number');
  });

  it('strips T-suffix from date in approval payload', async () => {
    const tx = makeTx({ date: '2026-06-14T08:00:00Z' });
    await approveRecurrenceMatch('rec-1', '2026-06', tx);
    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06'].date).toBe('2026-06-14');
  });

  it('appends to an existing approval instead of overwriting (mirror stays on first entry)', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: {
          '2026-06': {
            txId: 'tx-1',
            amount: -1200,
            date: '2026-06-02',
            approvedAt: 111,
            entries: [{ txId: 'tx-1', amount: -1200, date: '2026-06-02' }],
          },
        },
      }),
    });
    const tx = makeTx({ id: 'tx-2', montant: -800, date: '2026-06-05' });
    await approveRecurrenceMatch('rec-1', '2026-06', tx);

    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06']).toEqual({
      txId: 'tx-1',
      amount: -1200,
      date: '2026-06-02',
      approvedAt: 111,
      entries: [
        { txId: 'tx-1', amount: -1200, date: '2026-06-02' },
        { txId: 'tx-2', amount: -800, date: '2026-06-05' },
      ],
    });
  });

  it('appends onto a legacy single-tx approval (no entries field)', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: {
          '2026-06': { txId: 'tx-1', amount: -1200, date: '2026-06-02', approvedAt: 111 },
        },
      }),
    });
    const tx = makeTx({ id: 'tx-2', montant: -800, date: '2026-06-05' });
    await approveRecurrenceMatch('rec-1', '2026-06', tx);

    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06'].entries).toEqual([
      { txId: 'tx-1', amount: -1200, date: '2026-06-02' },
      { txId: 'tx-2', amount: -800, date: '2026-06-05' },
    ]);
  });

  it('is a no-op when the tx is already linked to the month', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: {
          '2026-06': { txId: 'tx-1', amount: -1200, date: '2026-06-02', approvedAt: 111 },
        },
      }),
    });
    await approveRecurrenceMatch('rec-1', '2026-06', makeTx({ id: 'tx-1' }));
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});

describe('unlinkRecurrenceTx', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    deleteFieldMock.mockClear();
    getDocMock.mockClear();
  });

  it('removes one entry and re-mirrors the first remaining entry', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: {
          '2026-06': {
            txId: 'tx-1',
            amount: -1200,
            date: '2026-06-02',
            approvedAt: 111,
            entries: [
              { txId: 'tx-1', amount: -1200, date: '2026-06-02' },
              { txId: 'tx-2', amount: -800, date: '2026-06-05' },
            ],
          },
        },
      }),
    });
    await unlinkRecurrenceTx('rec-1', 'tx-1');

    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06']).toEqual({
      txId: 'tx-2',
      amount: -800,
      date: '2026-06-05',
      approvedAt: 111,
      entries: [{ txId: 'tx-2', amount: -800, date: '2026-06-05' }],
    });
  });

  it('deletes the whole month when removing the last entry (legacy shape)', async () => {
    getDocMock.mockResolvedValue({
      data: () => ({
        approvedMonths: {
          '2026-06': { txId: 'tx-1', amount: -1200, date: '2026-06-02', approvedAt: 111 },
        },
      }),
    });
    await unlinkRecurrenceTx('rec-1', 'tx-1');

    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06']).toBe('__deleteField__');
  });

  it('is a no-op when the tx is not linked anywhere', async () => {
    getDocMock.mockResolvedValue({ data: () => ({ approvedMonths: {} }) });
    await unlinkRecurrenceTx('rec-1', 'tx-404');
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});

describe('unapproveRecurrenceMonth', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    deleteFieldMock.mockClear();
  });

  it('calls updateDoc with deleteField() for the month key', async () => {
    await unapproveRecurrenceMonth('rec-1', '2026-06');
    expect(updateDocMock).toHaveBeenCalledOnce();
    const [, update] = updateDocMock.mock.calls[0]!;
    expect(update['approvedMonths.2026-06']).toBe('__deleteField__');
  });
});

describe('removeRecurrence', () => {
  beforeEach(() => deleteDocMock.mockClear());

  it('calls deleteDoc with the correct ref', async () => {
    await removeRecurrence('rec-42');
    expect(deleteDocMock).toHaveBeenCalledOnce();
    expect(docMock).toHaveBeenCalledWith({}, 'recurrences', 'rec-42');
  });
});

describe('setRecurrenceActive', () => {
  beforeEach(() => updateDocMock.mockClear());

  it('calls updateDoc with { active: false }', async () => {
    await setRecurrenceActive('rec-1', false);
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, { active: false });
  });

  it('calls updateDoc with { active: true }', async () => {
    await setRecurrenceActive('rec-1', true);
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, { active: true });
  });
});

describe('updateRecurrence', () => {
  beforeEach(() => updateDocMock.mockClear());

  it('forwards the provided fields as-is', async () => {
    await updateRecurrence('rec-1', { label: 'Netflix Premium', expectedAmount: -17.99 });
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, {
      label: 'Netflix Premium',
      expectedAmount: -17.99,
    });
  });

  it('forwards anchorDate as-is without deriving dayOfMonth', async () => {
    await updateRecurrence('rec-1', { anchorDate: '2026-07-22' });
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, {
      anchorDate: '2026-07-22',
    });
  });
});

describe('skipRecurrencePeriod / unskipRecurrencePeriod', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    arrayUnionMock.mockClear();
    arrayRemoveMock.mockClear();
  });

  it('skip: calls updateDoc with arrayUnion(periodKey)', async () => {
    await skipRecurrencePeriod('rec-1', '2026-07');
    expect(arrayUnionMock).toHaveBeenCalledWith('2026-07');
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, {
      skippedPeriods: { __arrayUnion__: ['2026-07'] },
    });
  });

  it('unskip: calls updateDoc with arrayRemove(periodKey)', async () => {
    await unskipRecurrencePeriod('rec-1', '2026-07');
    expect(arrayRemoveMock).toHaveBeenCalledWith('2026-07');
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, {
      skippedPeriods: { __arrayRemove__: ['2026-07'] },
    });
  });
});

describe('addRecurrenceAlias', () => {
  beforeEach(() => {
    updateDocMock.mockClear();
    arrayUnionMock.mockClear();
  });

  it('normalizes the label before adding it as an alias', async () => {
    await addRecurrenceAlias('rec-1', 'Amazon Prïme  Vidéo');
    expect(arrayUnionMock).toHaveBeenCalledWith('amazon-prime-video');
    expect(updateDocMock).toHaveBeenCalledWith(fakeDocRef, {
      aliases: { __arrayUnion__: ['amazon-prime-video'] },
    });
  });
});
