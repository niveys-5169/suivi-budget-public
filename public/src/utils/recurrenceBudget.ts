import type { BudgetBase } from '../types/banking.types';
import { categoryKey } from './budgetHelpers';

export interface BudgetAdjustment {
  budget: BudgetBase;
  /** Nouveau montant du budget (mensuel, ou annuel pour une enveloppe annuelle). */
  montant: number;
}

/**
 * Budget de dépense de la catégorie d'une récurrence, et son montant une fois
 * répercuté l'écart `oldAmount → newAmount` (valeurs absolues, mensuelles). Un
 * budget annuel reçoit l'écart × 12. `null` s'il n'y a rien à ajuster.
 */
export function computeBudgetAdjustment(
  budgets: BudgetBase[],
  category: string,
  oldAmount: number,
  newAmount: number,
): BudgetAdjustment | null {
  const delta = newAmount - oldAmount;
  if (delta === 0) return null;
  const key = categoryKey(category);
  const budget = budgets.find(
    (b) =>
      b.actif !== false &&
      b.isIncome !== true &&
      (b.type === 'mensuel' || b.type === 'annuel') &&
      categoryKey(b.categorie) === key,
  );
  if (!budget) return null;
  const scaled = budget.type === 'annuel' ? delta * 12 : delta;
  const montant = Math.max(0, Math.round(((Number(budget.montant) || 0) + scaled) * 100) / 100);
  return { budget, montant };
}
