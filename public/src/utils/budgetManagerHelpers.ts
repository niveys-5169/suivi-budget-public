import type { BudgetBase } from '../types/banking.types';
import { isIncomeBudget } from './budgetHelpers';

const byLabelFr = (a: BudgetBase, b: BudgetBase) =>
  String(a.nom || a.categorie).localeCompare(String(b.nom || b.categorie), 'fr');

/**
 * Comparateur « ordre manuel d'abord » : les éléments avec un rang (`ordre`) passent
 * devant, triés par rang ; les autres (jamais réordonnés) suivent selon `fallback`.
 */
export function manualOrderComparator<T>(
  getOrder: (item: T) => number | undefined,
  fallback: (a: T, b: T) => number,
): (a: T, b: T) => number {
  const rank = (x: T) => getOrder(x) ?? Infinity;
  // Infinity - Infinity = NaN (falsy) → repli.
  return (a, b) => rank(a) - rank(b) || fallback(a, b);
}

const byManualOrderThenLabel = manualOrderComparator<BudgetBase>((b) => b.ordre, byLabelFr);

/** Budgets actifs triés : dépenses puis revenus, chacun par ordre manuel puis alpha. */
export function sortBudgetsByType(budgets: BudgetBase[]): BudgetBase[] {
  const active = budgets.filter((b) => b.actif !== false);
  const expenses = active.filter((b) => !isIncomeBudget(b)).sort(byManualOrderThenLabel);
  const incomes = active.filter((b) => isIncomeBudget(b)).sort(byManualOrderThenLabel);
  return [...expenses, ...incomes];
}

/**
 * Déplace l'enveloppe `index` d'un cran (-1 = haut, +1 = bas) sans franchir la
 * frontière dépenses / revenus. Renvoie la nouvelle liste, ou null si impossible.
 */
export function moveBudget(
  sorted: BudgetBase[],
  index: number,
  direction: -1 | 1,
): BudgetBase[] | null {
  const target = index + direction;
  const current = sorted[index];
  const neighbor = sorted[target];
  if (!current || !neighbor || isIncomeBudget(current) !== isIncomeBudget(neighbor)) return null;
  const next = [...sorted];
  next[index] = neighbor;
  next[target] = current;
  return next;
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
