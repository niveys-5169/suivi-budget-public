import { describe, it, expect } from 'vitest';
import {
  sortBudgetsByType,
  computeBudgetTotals,
  computeCandidateCategories,
} from '../../public/src/utils/budgetManagerHelpers';
import type { BudgetBase } from '../../public/src/types/banking.types';

const budget = (over: Partial<BudgetBase>): BudgetBase =>
  ({ id: 'b', categorie: 'Cat', montant: 0, ...over }) as BudgetBase;

describe('sortBudgetsByType', () => {
  it('lists expenses (alpha) before incomes (alpha), dropping inactive ones', () => {
    const budgets = [
      budget({ id: '1', categorie: 'Zoo', montant: 10 }),
      budget({ id: '2', categorie: 'Salaire', isIncome: true }),
      budget({ id: '3', categorie: 'Apéro', montant: 5 }),
      budget({ id: '4', categorie: 'Inactif', actif: false }),
      budget({ id: '5', categorie: 'Bonus', type: 'revenu' }),
    ];
    const sorted = sortBudgetsByType(budgets);
    expect(sorted.map((b) => b.categorie)).toEqual(['Apéro', 'Zoo', 'Bonus', 'Salaire']);
  });

  it('respects an explicit isIncome:false override even with type revenu', () => {
    const budgets = [budget({ categorie: 'Forced', type: 'revenu', isIncome: false })];
    const sorted = sortBudgetsByType(budgets);
    // treated as expense → still present, first
    expect(sorted).toHaveLength(1);
    expect(sorted[0]!.categorie).toBe('Forced');
  });
});

describe('computeBudgetTotals', () => {
  it('sums incomes and expenses separately and counts all', () => {
    const sorted = [
      budget({ categorie: 'Courses', montant: 300 }),
      budget({ categorie: 'Loyer', montant: 800 }),
      budget({ categorie: 'Salaire', montant: 2500, isIncome: true }),
    ];
    expect(computeBudgetTotals(sorted)).toEqual({
      incomeTotal: 2500,
      expenseTotal: 1100,
      count: 3,
    });
  });
});

describe('computeCandidateCategories', () => {
  it('merges budget + transaction categories, removes existing, sorts FR', () => {
    const result = computeCandidateCategories(
      ['Épargne', 'Voyage'],
      ['Voyage', 'Restaurant', 'Apéro'],
      new Set(['Apéro']),
    );
    expect(result).toEqual(['Épargne', 'Restaurant', 'Voyage']);
  });

  it('returns an empty list when everything already exists', () => {
    const result = computeCandidateCategories(['A'], ['B'], new Set(['A', 'B']));
    expect(result).toEqual([]);
  });
});
