import { describe, it, expect } from 'vitest';
import {
  buildCategoryList,
  detectIncomeCategories,
  buildSimplifiedBuckets,
  isBudgetInCalculationScope,
  computeIncomeBudget,
  computeSpentInBudget,
  computeCategoryGroups,
  type CategoryGroup,
  type ScopedBudgetLike,
} from '../../public/src/utils/analyseAggregations';
import type { Transaction } from '../../public/src/types/banking.types';
import type { CategorySummary } from '../../public/src/components/analyse/analyseTypes';

const groups = (g: Record<string, CategoryGroup>) => g;

describe('buildCategoryList', () => {
  const opts = { hiddenCategories: new Set<string>(), budgets: [] };

  it('drops zero-amount categories and sorts by amount desc', () => {
    const list = buildCategoryList(
      groups({
        Courses: { amount: 300, count: 3 },
        Vide: { amount: 0, count: 0 },
        Loyer: { amount: 800, count: 1 },
      }),
      1100,
      false,
      'sorties',
      opts,
    );
    expect(list.map((c) => c.name)).toEqual(['Loyer', 'Courses']);
    expect(list[0]!.percentage).toBeCloseTo((800 / 1100) * 100);
  });

  it('skips hidden categories when skipHidden is true', () => {
    const list = buildCategoryList(
      groups({ Courses: { amount: 300, count: 3 }, Loyer: { amount: 800, count: 1 } }),
      1100,
      true,
      'sorties',
      { hiddenCategories: new Set(['Loyer']), budgets: [] },
    );
    expect(list.map((c) => c.name)).toEqual(['Courses']);
  });

  it('marks a category as exceeded (red) when over budget on the sorties tab', () => {
    const list = buildCategoryList(
      groups({ Courses: { amount: 500, count: 3 } }),
      500,
      false,
      'sorties',
      { hiddenCategories: new Set(), budgets: [{ categorie: 'Courses', montant: 300 }] },
    );
    expect(list[0]!.isExceeded).toBe(true);
    expect(list[0]!.color).toBe('#EF4444');
    expect(list[0]!.budget).toBe(300);
  });

  it('does not flag exceeded outside the sorties tab', () => {
    const list = buildCategoryList(
      groups({ Salaire: { amount: 500, count: 1 } }),
      500,
      false,
      'entrees',
      { hiddenCategories: new Set(), budgets: [{ categorie: 'Salaire', montant: 300 }] },
    );
    expect(list[0]!.isExceeded).toBe(false);
  });
});

describe('detectIncomeCategories', () => {
  it('keeps categories that are majority-positive', () => {
    const txs = [
      { categorie: 'Salaire', montant: 2000 },
      { categorie: 'Salaire', montant: 2000 },
      { categorie: 'Courses', montant: -50 },
      { categorie: 'Remboursement', montant: 30 },
      { categorie: 'Remboursement', montant: 20 },
      { categorie: 'Remboursement', montant: -10 },
    ] as Transaction[];
    const cats = detectIncomeCategories(txs);
    expect(cats.has('Salaire')).toBe(true);
    expect(cats.has('Remboursement')).toBe(true);
    expect(cats.has('Courses')).toBe(false);
  });

  it('ignores transactions without a category', () => {
    const cats = detectIncomeCategories([{ montant: 100 } as Transaction]);
    expect(cats.size).toBe(0);
  });

  it('excludes categories with equal pos/neg counts', () => {
    const txs = [
      { categorie: 'Mixte', montant: 50 },
      { categorie: 'Mixte', montant: -50 },
    ] as Transaction[];
    expect(detectIncomeCategories(txs).has('Mixte')).toBe(false);
  });
});

describe('buildSimplifiedBuckets', () => {
  it('groups categories into buckets with correct percentages', () => {
    const cats = [
      { name: 'Loyer', amount: 800 },
      { name: 'Restaurant', amount: 200 },
    ] as CategorySummary[];
    const buckets = buildSimplifiedBuckets(cats);
    const total = buckets.reduce((s, b) => s + b.amount, 0);
    expect(total).toBe(1000);
    const pctSum = buckets.reduce((s, b) => s + b.percentage, 0);
    expect(pctSum).toBeCloseTo(100);
  });

  it('returns zero percentages when there are no categories', () => {
    const buckets = buildSimplifiedBuckets([]);
    expect(buckets.every((b) => b.amount === 0 && b.percentage === 0)).toBe(true);
  });
});

const budget = (b: Partial<ScopedBudgetLike> & { id: string }): ScopedBudgetLike => b;

describe('isBudgetInCalculationScope', () => {
  it('accepts every active budget when the scope is empty', () => {
    expect(isBudgetInCalculationScope(budget({ id: 'b1', categorie: 'Courses' }), [])).toBe(true);
  });

  it('rejects an inactive budget even when in scope', () => {
    expect(isBudgetInCalculationScope(budget({ id: 'b1', actif: false }), [])).toBe(false);
  });

  it('matches on id or on categorie', () => {
    expect(isBudgetInCalculationScope(budget({ id: 'b1', categorie: 'Courses' }), ['b1'])).toBe(
      true,
    );
    expect(
      isBudgetInCalculationScope(budget({ id: 'b1', categorie: 'Courses' }), ['Courses']),
    ).toBe(true);
    expect(isBudgetInCalculationScope(budget({ id: 'b1', categorie: 'Courses' }), ['Loyer'])).toBe(
      false,
    );
  });
});

describe('computeIncomeBudget', () => {
  const incomeCats = new Set<string>(['Freelance']);

  it('sums income budgets via explicit flag, type revenu, or detected income category', () => {
    const budgets = [
      budget({ id: 'salary', categorie: 'Salaire', montant: 2000, isIncome: true }),
      budget({ id: 'rev', categorie: 'Divers', montant: 500, type: 'revenu' }),
      budget({ id: 'free', categorie: 'Freelance', montant: 300 }),
      budget({ id: 'courses', categorie: 'Courses', montant: 400 }),
    ];
    expect(computeIncomeBudget(budgets, [], incomeCats)).toBe(2800);
  });

  it('respects the calculation scope and skips inactive budgets', () => {
    const budgets = [
      budget({ id: 'salary', categorie: 'Salaire', montant: 2000, isIncome: true }),
      budget({ id: 'bonus', categorie: 'Prime', montant: 500, isIncome: true, actif: false }),
    ];
    expect(computeIncomeBudget(budgets, ['salary'], incomeCats)).toBe(2000);
    expect(computeIncomeBudget(budgets, [], incomeCats)).toBe(2000);
  });
});

describe('computeSpentInBudget', () => {
  const txs = [
    { id: '1', categorie: 'Courses', montant: -50 },
    { id: '2', categorie: 'Courses', montant: -30 },
    { id: '3', categorie: 'Loyer', montant: -800 },
    { id: '4', categorie: 'Courses', montant: 20 }, // crédit ignoré
    { id: '5', categorie: 'Cadeaux', montant: -10 }, // hors budget
  ] as Transaction[];

  it('sums negative amounts on budgeted categories within scope', () => {
    const budgets = [
      budget({ id: 'b1', categorie: 'Courses', montant: 200 }),
      budget({ id: 'b2', categorie: 'Loyer', montant: 800 }),
    ];
    expect(computeSpentInBudget(txs, budgets, [])).toBe(880);
    expect(computeSpentInBudget(txs, budgets, ['b1'])).toBe(80);
  });
});

describe('computeCategoryGroups', () => {
  const txs = [
    { id: '1', categorie: 'Salaire', montant: 2000, date: '2026-01-05' },
    { id: '2', categorie: 'Courses', montant: -50, date: '2026-01-06' },
    { id: '3', categorie: 'Courses', montant: -30, date: '2026-01-07' },
    { id: '4', categorie: 'Loyer', montant: -800, date: '2026-01-01' },
  ] as Transaction[];

  it('aggregates expenses on the sorties tab and computes visible totals', () => {
    const res = computeCategoryGroups(txs, 'sorties', new Set());
    expect(res.rawTransactions).toHaveLength(3);
    expect(res.groups.Courses).toEqual({ amount: 80, count: 2 });
    expect(res.groups.Loyer).toEqual({ amount: 800, count: 1 });
    expect(res.visibleTotal).toBe(880);
    expect(res.totalEntrees).toBe(2000);
    expect(res.totalSorties).toBe(880);
  });

  it('excludes hidden categories from the visible total but keeps them in groups', () => {
    const res = computeCategoryGroups(txs, 'sorties', new Set(['Loyer']));
    expect(res.groups.Loyer).toEqual({ amount: 800, count: 1 });
    expect(res.visibleTotal).toBe(80);
    expect(res.totalSorties).toBe(80);
  });

  it('aggregates only incomes on the entrees tab', () => {
    const res = computeCategoryGroups(txs, 'entrees', new Set());
    expect(res.rawTransactions).toHaveLength(1);
    expect(res.groups.Salaire).toEqual({ amount: 2000, count: 1 });
    expect(res.visibleTotal).toBe(2000);
  });
});
