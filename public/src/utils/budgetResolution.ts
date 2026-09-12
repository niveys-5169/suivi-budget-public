import { BudgetBase } from '../types/banking.types';
import { budgetDocKey } from './budgetKey';

interface MonthlyOverride {
  mois: string;
  categorie: string;
  budget: number;
}

interface AnnualOverride {
  id: string;
  budget: number;
}

/**
 * Resolves the effective montant for each budget line given the current view context.
 *
 * Priority in monthly mode: monthly override > base (annuel type ÷ 12) > base as-is.
 * Priority in annual  mode: annual override (strict ID match) > base (mensuel type × 12) > base as-is.
 *
 * Annual overrides are matched by exact doc ID (`${year}__${budgetDocKey(categorie)}`) to prevent
 * stale overrides written by older code (with different ID formats) from silently taking effect.
 */
export function resolveEffectiveBudgets(
  base: BudgetBase[],
  monthly: MonthlyOverride[],
  annual: AnnualOverride[],
  monthKey: string,
  viewMode: 'monthly' | 'annual',
): BudgetBase[] {
  const year = monthKey.split('-')[0];

  return base.map((b) => {
    const mOverride = monthly.find((m) => m.mois === monthKey && m.categorie === b.categorie);
    const expectedAnnualId = `${year}__${budgetDocKey(b.categorie)}`;
    const aOverride = annual.find((a) => a.id === expectedAnnualId);

    let montant = b.montant;
    if (viewMode === 'monthly') {
      if (mOverride) {
        montant = mOverride.budget;
      } else if (b.type === 'annuel') {
        montant = b.montant / 12;
      }
    } else {
      if (aOverride) {
        montant = aOverride.budget;
      } else if (b.type === 'mensuel' || !b.type) {
        montant = b.montant * 12;
      }
    }

    return { ...b, montant };
  });
}
