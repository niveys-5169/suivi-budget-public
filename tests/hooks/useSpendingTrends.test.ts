import { describe, it, expect } from 'vitest';
import { computeSpendingTrends } from '../../public/src/utils/computeSpendingTrends';

function makeTx(categorie: string, montant: number, mois: string) {
  return {
    id: Math.random().toString(),
    libelle: 'test',
    montant,
    compte: 'CCP',
    date: `${mois}-15`,
    categorie,
    moisAffectation: mois,
  };
}

describe('computeSpendingTrends', () => {
  it('agrège les dépenses par mois', () => {
    const transactions = [
      makeTx('Alimentation', -100, '2026-04'),
      makeTx('Alimentation', -80, '2026-03'),
    ];

    const { breakdown } = computeSpendingTrends(transactions, 6, '2026-05');
    const april = breakdown.find((b) => b.monthKey === '2026-04');
    expect(april).toBeDefined();
    expect(april!.byCategory['Alimentation']).toBe(100);
  });

  it('ignore les transactions positives (revenus)', () => {
    const transactions = [
      makeTx('Revenus', 3000, '2026-04'),
      makeTx('Alimentation', -100, '2026-04'),
    ];

    const { breakdown } = computeSpendingTrends(transactions, 3, '2026-05');
    const april = breakdown.find((b) => b.monthKey === '2026-04');
    expect(april?.byCategory['Revenus']).toBeUndefined();
    expect(april?.total).toBe(100);
  });

  it('calcule le delta % entre le mois courant et le précédent pour une catégorie', () => {
    const transactions = [
      makeTx('Restaurants', -200, '2026-04'),
      makeTx('Restaurants', -100, '2026-03'),
    ];

    const { trends } = computeSpendingTrends(transactions, 3, '2026-05');
    const restaurantsTrend = trends.find((t) => t.category === 'Restaurants');
    expect(restaurantsTrend).toBeDefined();
    // (200 - 100) / 100 * 100 = +100%
    expect(restaurantsTrend!.deltaPct).toBeCloseTo(100);
  });

  it('retourne deltaPct null si pas de mois précédent pour la catégorie', () => {
    const transactions = [makeTx('Loisirs', -50, '2026-04')];

    const { trends } = computeSpendingTrends(transactions, 3, '2026-05');
    const trend = trends.find((t) => t.category === 'Loisirs');
    expect(trend!.deltaPct).toBeNull();
  });

  it('retourne les topIncreases triés par delta décroissant', () => {
    const transactions = [
      makeTx('A', -300, '2026-04'),
      makeTx('A', -100, '2026-03'),
      makeTx('B', -150, '2026-04'),
      makeTx('B', -100, '2026-03'),
    ];

    const { topIncreases } = computeSpendingTrends(transactions, 3, '2026-05');
    expect(topIncreases[0]!.category).toBe('A'); // +200% > +50%
  });

  it('ne renvoie que les N derniers mois demandés', () => {
    const transactions = [
      makeTx('Transport', -50, '2025-10'), // trop vieux pour 3M
      makeTx('Transport', -50, '2026-04'),
    ];

    const { breakdown } = computeSpendingTrends(transactions, 3, '2026-05');
    const monthKeys = breakdown.map((b) => b.monthKey);
    expect(monthKeys).not.toContain('2025-10');
  });
});
