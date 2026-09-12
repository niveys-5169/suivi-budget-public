import type { BudgetBase } from '../types/banking.types';
import { isIncomeBudget } from './budgetHelpers';

const byLabelFr = (a: BudgetBase, b: BudgetBase) =>
  String(a.nom || a.categorie).localeCompare(String(b.nom || b.categorie), 'fr');

/** Budgets actifs triés : dépenses (alpha) puis revenus (alpha). */
export function sortBudgetsByType(budgets: BudgetBase[]): BudgetBase[] {
  const active = budgets.filter((b) => b.actif !== false);
  const expenses = active.filter((b) => !isIncomeBudget(b)).sort(byLabelFr);
  const incomes = active.filter((b) => isIncomeBudget(b)).sort(byLabelFr);
  return [...expenses, ...incomes];
}

export interface BudgetTotals {
  incomeTotal: number;
  expenseTotal: number;
  count: number;
}

/** Totaux revenus / dépenses et nombre de catégories. */
export function computeBudgetTotals(sortedBudgets: BudgetBase[]): BudgetTotals {
  const incomeTotal = sortedBudgets
    .filter((b) => isIncomeBudget(b))
    .reduce((s, b) => s + (Number(b.montant) || 0), 0);
  const expenseTotal = sortedBudgets
    .filter((b) => !isIncomeBudget(b))
    .reduce((s, b) => s + (Number(b.montant) || 0), 0);
  return { incomeTotal, expenseTotal, count: sortedBudgets.length };
}

/** Catégories candidates (budgets + transactions) non encore budgétées, triées FR. */
export function computeCandidateCategories(
  budgetCandidates: string[],
  txCategories: string[],
  existingCategories: Set<string>,
): string[] {
  const merged = new Set<string>([...budgetCandidates, ...txCategories]);
  return Array.from(merged)
    .filter((c) => !existingCategories.has(c))
    .sort((a, b) => a.localeCompare(b, 'fr'));
}
