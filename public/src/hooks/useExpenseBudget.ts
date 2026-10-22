import { useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { useAppState } from '../context/AppStateContext';
import { computeReferenceIncome } from '../utils/ravCalculations';

/**
 * Budget de dépenses = revenu de référence mensuel (Salaires + CAF dédupliqués).
 * En mode annuel, la valeur mensuelle est multipliée par 12.
 */
export const useExpenseBudget = (): number => {
  const { ravConfig, recurrences } = useGlobalData();
  const { budgetPeriodMode, monthKey } = useAppState();

  return useMemo(() => {
    const monthly = computeReferenceIncome(ravConfig, recurrences, monthKey);
    return budgetPeriodMode === 'year' ? monthly * 12 : monthly;
  }, [ravConfig, recurrences, budgetPeriodMode, monthKey]);
};
