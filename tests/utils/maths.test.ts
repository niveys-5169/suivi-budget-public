import { describe, it, expect } from 'vitest';
import {
  computeLabelSimilarity,
  aggregateMonthlyTransactions,
  detectRecurringTransactionsPure,
} from '../../public/src/utils/maths';

describe('computeLabelSimilarity', () => {
  it('returns 1 for identical labels', () => {
    expect(computeLabelSimilarity('Netflix abonnement', 'Netflix abonnement')).toBe(1);
  });

  it('returns 1 for two empty labels', () => {
    expect(computeLabelSimilarity('', '')).toBe(1);
  });

  it('returns 0 when one label is empty', () => {
    expect(computeLabelSimilarity('Netflix', '')).toBe(0);
    expect(computeLabelSimilarity('', 'Amazon')).toBe(0);
  });

  it('returns partial score for overlapping tokens', () => {
    const score = computeLabelSimilarity('virement salaire mensuel', 'salaire versement mensuel');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('is case-insensitive and accent-insensitive', () => {
    const score = computeLabelSimilarity('Épicerie fine', 'epicerie fine');
    expect(score).toBe(1);
  });

  it('ignores short tokens (≤ 2 chars)', () => {
    // "de" and "la" are 2-char → stripped → effectively empty
    const score = computeLabelSimilarity('de la', 'du le');
    expect(score).toBe(1);
  });
});

describe('aggregateMonthlyTransactions', () => {
  const resolveKey = (tx: { date?: string }) => String(tx.date || '').slice(0, 7);

  it('returns empty aggregation for no transactions', () => {
    const result = aggregateMonthlyTransactions([], resolveKey);
    expect(result.keys).toHaveLength(0);
    expect(result.dep).toHaveLength(0);
    expect(result.rec).toHaveLength(0);
    expect(result.soldes).toHaveLength(0);
  });

  it('separates depenses (< 0) from recettes (>= 0)', () => {
    const txs = [
      { date: '2024-01-10', montant: -150 },
      { date: '2024-01-20', montant: 2500 },
    ];
    const result = aggregateMonthlyTransactions(txs, resolveKey);
    expect(result.keys).toEqual(['2024-01']);
    expect(result.dep[0]).toBe(150);
    expect(result.rec[0]).toBe(2500);
  });

  it('sorts months chronologically', () => {
    const txs = [
      { date: '2024-03-01', montant: -50 },
      { date: '2024-01-01', montant: -100 },
      { date: '2024-02-01', montant: -75 },
    ];
    const result = aggregateMonthlyTransactions(txs, resolveKey);
    expect(result.keys).toEqual(['2024-01', '2024-02', '2024-03']);
  });

  it('computes running soldes correctly', () => {
    const txs = [
      { date: '2024-01-01', montant: 1000 },
      { date: '2024-01-15', montant: -200 },
      { date: '2024-02-01', montant: 1000 },
      { date: '2024-02-15', montant: -300 },
    ];
    const result = aggregateMonthlyTransactions(txs, resolveKey);
    expect(result.soldes[0]).toBeCloseTo(800, 1);
    expect(result.soldes[1]).toBeCloseTo(1500, 1);
  });

  it('skips transactions with no month key', () => {
    const txs = [
      { date: '', montant: -100 },
      { date: '2024-05-01', montant: -200 },
    ];
    const result = aggregateMonthlyTransactions(txs, resolveKey);
    expect(result.keys).toEqual(['2024-05']);
  });
});

describe('detectRecurringTransactionsPure', () => {
  const MOCK_DATE = new Date('2024-03-15T12:00:00.000Z'); // Consistent reference date for testing

  it('should detect recurring transactions based on category, label similarity, and amount variance', () => {
    const transactions = [
      // Recurring group 1: Netflix, similar labels, amounts within 20%
      { date: '2023-12-01', montant: -12.99, categorie: 'Abonnements', libelle: 'Netflix Premium' },
      { date: '2024-01-01', montant: -13.0, categorie: 'Abonnements', libelle: 'Netflix Premium' },
      {
        date: '2024-02-01',
        montant: -12.95,
        categorie: 'Abonnements',
        libelle: 'Netflix Premium',
      },
      { date: '2024-03-01', montant: -15.0, categorie: 'Abonnements', libelle: 'Netflix Premium' }, // Amount slightly higher, still within 20% of 12.99

      // Not recurring: Spotify - different label
      { date: '2024-01-05', montant: -9.99, categorie: 'Abonnements', libelle: 'Spotify Premium' },
      { date: '2024-02-05', montant: -9.99, categorie: 'Abonnements', libelle: 'Spotify Premium' },
      { date: '2024-03-05', montant: -9.99, categorie: 'Abonnements', libelle: 'Spotify Premium' },

      // Not recurring: Different category
      { date: '2024-01-10', montant: -50.0, categorie: 'Courses', libelle: 'Supermarket' },
      { date: '2024-02-10', montant: -55.0, categorie: 'Courses', libelle: 'Grocery Store' },

      // Recurring group 2: Rent - high amount, fixed
      { date: '2023-10-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },
      { date: '2023-11-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },
      { date: '2023-12-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },
      { date: '2024-01-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },
      { date: '2024-02-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },
      { date: '2024-03-01', montant: -800.0, categorie: 'Loyer', libelle: 'Loyer Appartement' },

      // Not recurring due to insufficient recent activity (only 2 in last 120 days from MOCK_DATE)
      { date: '2023-10-01', montant: -25.0, categorie: 'Transport', libelle: 'Bus Pass' },
      { date: '2024-01-10', montant: -25.0, categorie: 'Transport', libelle: 'Bus Pass' }, // within 120 days
      { date: '2024-02-20', montant: -25.0, categorie: 'Transport', libelle: 'Bus Pass' }, // within 120 days
    ];

    const result = detectRecurringTransactionsPure(transactions, undefined, MOCK_DATE);

    expect(result).toHaveLength(3); // Expecting Netflix, Spotify and Loyer
    const netflix = result.find((item) => item.label.toUpperCase().includes('NETFLIX'));
    const spotify = result.find((item) => item.label.includes('Spotify'));
    const loyer = result.find((item) => item.label.includes('Loyer'));

    expect(netflix).toBeDefined();
    expect(netflix?.category).toBe('abonnements');
    expect(netflix?.avgAmount).toBeCloseTo(-13.48); // (12.99+13.00+12.95+15.00)/4
    expect(netflix?.count).toBe(4); // All 4 Netflix transactions are within 120 days
    expect(netflix?.label.toUpperCase()).toContain('NETFLIX'); // Robust label check

    expect(spotify).toBeDefined();
    expect(spotify?.category).toBe('abonnements');
    expect(spotify?.avgAmount).toBeCloseTo(-9.99);
    expect(spotify?.count).toBe(3);
    expect(spotify?.label).toBe('Spotify Premium');

    expect(loyer).toBeDefined();
    expect(loyer?.category).toBe('loyer');
    expect(loyer?.avgAmount).toBeCloseTo(-800);
    expect(loyer?.count).toBe(6); // All 6 Loyer transactions are within 180 days (Oct 1 to Mar 15)
    expect(loyer?.label).toBe('Loyer Appartement');
  });

  it('should filter out groups with less than 3 occurrences in the last 180 days', () => {
    const transactions = [
      { date: '2023-08-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // > 180 days from 2024-03-15
      { date: '2024-01-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
      { date: '2024-02-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
    ];
    // This group should not be detected as it only has 2 transactions within 180 days from MOCK_DATE (2024-03-15)
    // Aug 1 is > 180 days. Jan 1 is < 180 days, Feb 1 is < 180 days. So only 2 transactions.
    const result = detectRecurringTransactionsPure(transactions, undefined, MOCK_DATE);
    expect(result).toHaveLength(0);

    const transactionsWithEnoughRecentActivity = [
      { date: '2023-11-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
      { date: '2024-01-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
      { date: '2024-02-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
      { date: '2024-03-01', montant: -100, categorie: 'Test', libelle: 'Monthly Fee' }, // within 180 days
    ];
    const result2 = detectRecurringTransactionsPure(
      transactionsWithEnoughRecentActivity,
      undefined,
      MOCK_DATE,
    );
    expect(result2).toHaveLength(1);
    expect(result2[0]?.label).toBe('Monthly Fee');
    expect(result2[0]?.count).toBe(4); // All 4 transactions should be considered for count due to 180-day filter
  });
});
