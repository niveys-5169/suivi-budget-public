import { describe, it, expect } from 'vitest';
import { normalizeTransaction } from '../../public/src/services/transactionRepository';

const valid = {
  id: 'tx1',
  date: '2026-05-15',
  libelle: '  CARREFOUR  ',
  montant: 42.5,
  compte: 'LCL Nico',
  pointe: true,
};

describe('normalizeTransaction — valid inputs', () => {
  it('returns a Transaction for a minimal valid document', () => {
    const result = normalizeTransaction(valid);
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2026-05-15');
    expect(result!.libelle).toBe('CARREFOUR');
    expect(result!.montant).toBe(42.5);
  });

  it('converts a Firestore Timestamp to ISO date string', () => {
    const ts = {
      toDate: () => new Date('2026-03-01T10:00:00Z'),
    };
    const result = normalizeTransaction({ ...valid, date: ts });
    expect(result!.date).toBe('2026-03-01');
  });

  it('keeps emailDate as a Date (mail Linxo source)', () => {
    const at = new Date('2026-09-25T04:23:45Z');
    const result = normalizeTransaction({ ...valid, emailDate: { toDate: () => at } });
    expect(result!.emailDate).toEqual(at);
  });

  it('ignores a non-timestamp emailDate, like the importer', () => {
    const result = normalizeTransaction({ ...valid, emailDate: '2026-09-25' });
    expect(result!.emailDate).toBeUndefined();
  });

  it('slices a full ISO datetime string to date only', () => {
    const result = normalizeTransaction({ ...valid, date: '2026-05-15T12:34:56Z' });
    expect(result!.date).toBe('2026-05-15');
  });

  it('parses a numeric string amount from legacy data', () => {
    const result = normalizeTransaction({ ...valid, montant: '123.45' });
    expect(result!.montant).toBe(123.45);
  });

  it('sets pointe to false when field is missing', () => {
    const { pointe: _, ...noPointe } = valid;
    const result = normalizeTransaction(noPointe);
    expect(result!.pointe).toBe(false);
  });

  it('trims whitespace from libelle', () => {
    const result = normalizeTransaction({ ...valid, libelle: '  LIDL  ' });
    expect(result!.libelle).toBe('LIDL');
  });

  it('returns undefined for empty categorie', () => {
    const result = normalizeTransaction({ ...valid, categorie: '' });
    expect(result!.categorie).toBeUndefined();
  });

  it('returns undefined for empty commentaire', () => {
    const result = normalizeTransaction({ ...valid, commentaire: '   ' });
    expect(result!.commentaire).toBeUndefined();
  });

  it('slices moisAffectation to 7 characters', () => {
    const result = normalizeTransaction({ ...valid, moisAffectation: '2026-05-01' });
    expect(result!.moisAffectation).toBe('2026-05');
  });

  it('preserves source field', () => {
    const result = normalizeTransaction({ ...valid, source: 'gmail' });
    expect(result!.source).toBe('gmail');
  });

  it('preserves the importedAt Timestamp untouched', () => {
    const ts = { toDate: () => new Date('2026-05-15T00:00:00Z'), seconds: 1, nanoseconds: 0 };
    const result = normalizeTransaction({ ...valid, importedAt: ts });
    expect(result!.importedAt).toBe(ts);
  });

  it('ignores unknown Firestore fields', () => {
    const result = normalizeTransaction({ ...valid, owner: 'Nicolas', emailDate: 'whatever' });
    expect(result).not.toBeNull();
    expect((result as unknown as Record<string, unknown>).owner).toBeUndefined();
  });
});

describe('normalizeTransaction — invalid inputs', () => {
  it('returns null when date is missing', () => {
    const { date: _, ...noDate } = valid;
    expect(normalizeTransaction(noDate)).toBeNull();
  });

  it('returns null when libelle is missing', () => {
    const { libelle: _, ...noLibelle } = valid;
    expect(normalizeTransaction(noLibelle)).toBeNull();
  });

  it('returns null when montant is NaN', () => {
    expect(normalizeTransaction({ ...valid, montant: 'not-a-number' })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeTransaction(null as unknown as object)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeTransaction('string' as unknown as object)).toBeNull();
  });
});
