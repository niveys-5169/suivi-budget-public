import { describe, it, expect } from 'vitest';
import {
  isSpecialBudgetCategory,
  getStatusColor,
  calculateBudgetStats,
  formatPercentage,
  buildRecurringCategorySet,
  isRecurringBackedCategory,
  categoryKey,
  preferDisplayLabel,
  dedupeBudgetsByCategory,
} from '../../public/src/utils/budgetHelpers';
import type { Recurrence } from '../../public/src/types/banking.types';
import type { BudgetBase } from '../../public/src/types/banking.types';

describe('isSpecialBudgetCategory', () => {
  it('returns true for special category patterns', () => {
    expect(isSpecialBudgetCategory('Crédit voiture')).toBe(true);
    expect(isSpecialBudgetCategory('assurance habitation')).toBe(true);
    expect(isSpecialBudgetCategory('Vacances été')).toBe(true);
    expect(isSpecialBudgetCategory('Kdo anniversaire')).toBe(true);
    expect(isSpecialBudgetCategory('Prime annuelle')).toBe(true);
    expect(isSpecialBudgetCategory('Noel 2024')).toBe(true);
    expect(isSpecialBudgetCategory('Travaux cuisine')).toBe(true);
    expect(isSpecialBudgetCategory('Renouvellement contrat')).toBe(true);
  });

  it('returns false for ordinary categories', () => {
    expect(isSpecialBudgetCategory('Courses')).toBe(false);
    expect(isSpecialBudgetCategory('Restaurants')).toBe(false);
    expect(isSpecialBudgetCategory('Transport')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSpecialBudgetCategory('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSpecialBudgetCategory('CRÉDIT')).toBe(true);
    expect(isSpecialBudgetCategory('VACANCES')).toBe(true);
  });
});

describe('getStatusColor', () => {
  it('returns grey when budget is 0', () => {
    expect(getStatusColor(50, 0)).toBe('#6b7280');
  });

  it('returns green when under 75%', () => {
    expect(getStatusColor(70, 100)).toBe('#10b981');
  });

  it('returns orange between 75% and 89%', () => {
    expect(getStatusColor(80, 100)).toBe('#f59e0b');
  });

  it('returns red-light at exactly 90%', () => {
    expect(getStatusColor(90, 100)).toBe('#ef4444');
  });

  it('returns dark red when over 100%', () => {
    expect(getStatusColor(150, 100)).toBe('#dc2626');
  });
});

describe('calculateBudgetStats', () => {
  const budgets = [
    { id: 'courses', budget: 300 },
    { id: 'restau', budget: 150 },
  ];
  const expenseByCategory = { courses: 280, restau: 120 };

  it('calculates totalBudget correctly', () => {
    const stats = calculateBudgetStats(budgets, expenseByCategory);
    expect(stats.totalBudget).toBe(450);
  });

  it('calculates totalSpent as sum of expenses', () => {
    const stats = calculateBudgetStats(budgets, expenseByCategory);
    expect(stats.totalSpent).toBe(400);
  });

  it('calculates totalDiff = totalSpent - totalBudget', () => {
    const stats = calculateBudgetStats(budgets, expenseByCategory);
    expect(stats.totalDiff).toBe(-50);
  });

  it('calculates percentageUsed', () => {
    const stats = calculateBudgetStats(budgets, expenseByCategory);
    expect(stats.percentageUsed).toBeCloseTo((400 / 450) * 100, 1);
  });

  it('counts categoriesOnAlert (>= 90% of budget)', () => {
    // courses: 280/300 = 93% → alert; restau: 120/150 = 80% → no alert
    const stats = calculateBudgetStats(budgets, expenseByCategory);
    expect(stats.categoriesOnAlert).toBe(1);
  });

  it('handles empty inputs', () => {
    const stats = calculateBudgetStats([], {});
    expect(stats.totalBudget).toBe(0);
    expect(stats.totalSpent).toBe(0);
    expect(stats.percentageUsed).toBe(0);
  });
});

describe('buildRecurringCategorySet', () => {
  it('collects categories from active recurrences only', () => {
    const set = buildRecurringCategorySet([
      { id: 'spotify', category: 'Abonnements', active: true },
      { id: 'loyer', category: 'Logement', active: true },
      { id: 'inactive', category: 'Loisirs', active: false },
    ] as Recurrence[]);
    expect(set.has('abonnements')).toBe(true);
    expect(set.has('logement')).toBe(true);
    expect(set.has('loisirs')).toBe(false);
  });

  it('lowercases category names', () => {
    const set = buildRecurringCategorySet([
      { id: 'x', category: 'Téléphone', active: true },
    ] as Recurrence[]);
    expect(set.has('téléphone')).toBe(true);
    expect(set.has('autre')).toBe(false);
  });

  it('ignores recurrences without a category', () => {
    const set = buildRecurringCategorySet([
      { id: 'x', category: '', active: true },
    ] as Recurrence[]);
    expect(set.size).toBe(0);
  });
});

describe('isRecurringBackedCategory', () => {
  const recurringCats = new Set(['abonnements', 'logement']);

  it('matches a category covered by an accepted recurrence', () => {
    expect(isRecurringBackedCategory('Abonnements', recurringCats)).toBe(true);
    expect(isRecurringBackedCategory('  logement ', recurringCats)).toBe(true);
  });

  it('falls back to special (fixed) budget patterns', () => {
    expect(isRecurringBackedCategory('Crédit voiture', recurringCats)).toBe(true);
    expect(isRecurringBackedCategory('Assurance habitation', recurringCats)).toBe(true);
  });

  it('returns false for variable categories', () => {
    expect(isRecurringBackedCategory('Nourriture', recurringCats)).toBe(false);
    expect(isRecurringBackedCategory('Santé', recurringCats)).toBe(false);
    expect(isRecurringBackedCategory('Habits', recurringCats)).toBe(false);
  });
});

describe('categoryKey', () => {
  it('collapses case, accents, whitespace and NFC/NFD variants', () => {
    const nfc = 'Santé'.normalize('NFC');
    const nfd = 'Santé'.normalize('NFD'); // base letters + combining acute accent
    expect(nfd).not.toBe(nfc); // sanity: the two encodings are genuinely distinct
    const key = categoryKey(nfc);
    expect(categoryKey('santé')).toBe(key);
    expect(categoryKey('SANTÉ')).toBe(key);
    expect(categoryKey('  Santé  ')).toBe(key);
    expect(categoryKey(nfd)).toBe(key);
  });

  it('keeps genuinely different categories distinct', () => {
    expect(categoryKey('Santé')).not.toBe(categoryKey('Sport'));
    expect(categoryKey('Courses')).not.toBe(categoryKey('Sorties'));
  });

  it('handles null/undefined/empty', () => {
    expect(categoryKey(null)).toBe('');
    expect(categoryKey(undefined)).toBe('');
    expect(categoryKey('   ')).toBe('');
  });
});

describe('preferDisplayLabel', () => {
  it('prefers the accented spelling over the unaccented one', () => {
    expect(preferDisplayLabel('santé', 'Santé')).toBe('Santé');
    expect(preferDisplayLabel('Sante', 'Santé')).toBe('Santé');
  });

  it('trims and prefers the longer label on accent tie', () => {
    expect(preferDisplayLabel('Santé ', 'Sante')).toBe('Santé');
    expect(preferDisplayLabel('abc', 'abcdef')).toBe('abcdef');
  });

  it('falls back to the non-empty side', () => {
    expect(preferDisplayLabel('', 'Santé')).toBe('Santé');
    expect(preferDisplayLabel('Santé', '')).toBe('Santé');
  });
});

describe('dedupeBudgetsByCategory', () => {
  it('collapses accent/case/auto-id variants into one funded envelope', () => {
    const data = [
      { id: 'Santé', categorie: 'Santé', montant: 200, actif: true, type: 'mensuel' },
      { id: 'abc123def456ghi789jk', categorie: 'santé', montant: 0, actif: true, type: 'mensuel' },
    ] as BudgetBase[];

    const result = dedupeBudgetsByCategory(data);

    expect(result).toHaveLength(1);
    expect(result[0]!.categorie).toBe('Santé');
    expect(result[0]!.montant).toBe(200);
  });

  it('keeps the funded record regardless of input order', () => {
    const data = [
      { id: 'x1', categorie: 'santé ', montant: 0, actif: true, type: 'mensuel' },
      { id: 'Santé', categorie: 'Santé', montant: 150, actif: true, type: 'mensuel' },
    ] as BudgetBase[];

    const result = dedupeBudgetsByCategory(data);

    expect(result).toHaveLength(1);
    expect(result[0]!.categorie).toBe('Santé');
    expect(result[0]!.montant).toBe(150);
  });

  it('leaves genuinely different categories untouched', () => {
    const data = [
      { id: 'Santé', categorie: 'Santé', montant: 200, actif: true, type: 'mensuel' },
      { id: 'Sport', categorie: 'Sport', montant: 50, actif: true, type: 'mensuel' },
    ] as BudgetBase[];

    expect(dedupeBudgetsByCategory(data)).toHaveLength(2);
  });
});

describe('formatPercentage', () => {
  it('formats a normal percentage', () => {
    expect(formatPercentage(75.3)).toBe('75.3%');
  });

  it('caps at 100%', () => {
    expect(formatPercentage(120)).toBe('100%');
    expect(formatPercentage(100)).toBe('100%');
  });

  it('rounds to one decimal', () => {
    expect(formatPercentage(33.456)).toBe('33.5%');
  });

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0%');
  });
});
