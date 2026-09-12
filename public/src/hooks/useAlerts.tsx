import { useMemo } from 'react';
import { useBudget } from './useBudget';
import { useTransactionContext } from '../context/TransactionContext';
import { useGlobalData } from '../context/GlobalDataContext';
import { useAppState } from '../context/AppStateContext';
import { computeAlerts } from '../utils/computeAlerts';
import type { Alert } from '../types/banking.types';

/** Calcule les alertes actives (dépassements budgétaires, récurrences en
 * retard, hausses de prix) à partir des données du mois courant. */
export const useAlerts = (): { alerts: Alert[]; errorCount: number } => {
  const { budgets } = useBudget();
  const { transactions } = useTransactionContext();
  const { recurrences } = useGlobalData();
  const { monthKey } = useAppState();

  const alerts = useMemo(
    () =>
      computeAlerts({
        budgets,
        transactions,
        currentMonthKey: monthKey,
        recurrences,
      }),
    [budgets, transactions, monthKey, recurrences],
  );

  const errorCount = useMemo(() => alerts.filter((a) => a.type === 'error').length, [alerts]);

  return { alerts, errorCount };
};
