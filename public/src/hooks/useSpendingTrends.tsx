import { useMemo } from 'react';
import { useTransactionContext } from '../context/TransactionContext';
import { useAppState } from '../context/AppStateContext';
import { computeSpendingTrends } from '../utils/computeSpendingTrends';

export type TrendWindow = 3 | 6 | 12;

/** Calcule les tendances de dépenses sur 3/6/12 mois par catégorie. */
export const useSpendingTrends = (window: TrendWindow = 6) => {
  const { transactions } = useTransactionContext();
  const { monthKey } = useAppState();

  return useMemo(
    () => computeSpendingTrends(transactions, window, monthKey),
    [transactions, window, monthKey],
  );
};
