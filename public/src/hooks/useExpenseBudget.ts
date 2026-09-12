import { useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { useAppState } from '../context/AppStateContext';

interface SalaryProvision {
  montant?: number;
  categorie?: string;
}

/**
 * Budget de dépenses = somme des salaires saisis manuellement (RAV)
 * + somme des revenus récurrents actifs mensuels.
 *
 * En mode annuel, la valeur mensuelle est multipliée par 12.
 */
export const useExpenseBudget = (): number => {
  const { ravConfig, recurrences } = useGlobalData();
  const { budgetPeriodMode } = useAppState();

  return useMemo(() => {
    const provisions = (ravConfig?.provision_salaires ?? {}) as Record<string, SalaryProvision>;
    const salariesMonthly = Object.values(provisions).reduce<number>(
      (sum, p) => sum + (Number(p?.montant) || 0),
      0,
    );

    const incomeCats =
      typeof window !== 'undefined'
        ? (window as { CATEGORIES?: { Revenus?: string[] } }).CATEGORIES?.Revenus
        : null;

    const recurringIncomeMonthly = recurrences
      .filter((r) => r.active && r.expectedAmount > 0)
      .reduce<number>((sum, r) => {
        if (Array.isArray(incomeCats) && r.category && !incomeCats.includes(r.category)) {
          return sum;
        }
        return sum + r.expectedAmount;
      }, 0);

    const monthly = salariesMonthly + recurringIncomeMonthly;
    return budgetPeriodMode === 'year' ? monthly * 12 : monthly;
  }, [ravConfig, recurrences, budgetPeriodMode]);
};
