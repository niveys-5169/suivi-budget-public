import { useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useBudget } from './useBudget';
import { BudgetPeriodMode } from '../context/AppStateContext';

export interface CategoryMetrics {
  spentToDate: number;
  limit: number;
  elapsedDays: number;
  totalDays: number;
  pacePerDay: number;
  projectedEndAmount: number;
  varianceProjected: number;
  status: 'ok' | 'watch' | 'risk';
}

/** Nombre de jours dans l'année (gère les années bissextiles). */
const daysInYear = (year: number): number =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;

/** Quantième : numéro du jour dans l'année (1 = 1ᵉʳ janvier). */
const dayOfYear = (d: Date): number =>
  Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);

/** Calcule les métriques de projection budgétaire (tendance, prévision fin de mois) par catégorie. */
export const useBudgetProjection = (
  categoryId: string,
  periodMode: BudgetPeriodMode,
  monthKey: string,
) => {
  const { transactions } = useTransactions();
  const { budgets } = useBudget();

  const metrics = useMemo(() => {
    const now = new Date();
    const [year = NaN, month = NaN] = monthKey.split('-').map(Number);

    let elapsedDays: number;
    let totalDays: number;
    let filteredTransactions;

    if (periodMode === 'year') {
      const isCurrentYear = now.getFullYear() === year;
      totalDays = daysInYear(year);
      elapsedDays = isCurrentYear ? dayOfYear(now) : totalDays;
      filteredTransactions = transactions.filter((t) => {
        const txMonth = (t.moisAffectation || t.date || '').slice(0, 7);
        return txMonth.startsWith(year.toString()) && t.categorie === categoryId;
      });
    } else {
      const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
      totalDays = new Date(year, month, 0).getDate();
      elapsedDays = isCurrentMonth ? now.getDate() : totalDays;
      filteredTransactions = transactions.filter((t) => {
        const txMonth = (t.moisAffectation || t.date || '').slice(0, 7);
        return txMonth === monthKey && t.categorie === categoryId;
      });
    }

    const spentToDate = filteredTransactions.reduce(
      (sum, t) => sum + Math.abs(Number(t.montant) || 0),
      0,
    );

    // `budgets` are already resolved to the active viewMode (monthly amount in month
    // mode, annual amount in year mode) by resolveEffectiveBudgets — use as-is.
    const budget = budgets.find((b) => b.categorie === categoryId);
    const limit = budget?.montant || 0;

    const pacePerDay = spentToDate / Math.max(elapsedDays, 1);
    const projectedEndAmount = pacePerDay * totalDays;
    const varianceProjected = projectedEndAmount - limit;
    const consumedPct = limit > 0 ? (spentToDate / limit) * 100 : 0;

    let status: 'ok' | 'watch' | 'risk' = 'ok';
    if (consumedPct >= 100 || projectedEndAmount > limit) status = 'risk';
    else if (consumedPct >= 80) status = 'watch';

    return {
      spentToDate,
      limit,
      elapsedDays,
      totalDays,
      pacePerDay,
      projectedEndAmount,
      varianceProjected,
      status,
    };
  }, [transactions, budgets, categoryId, periodMode, monthKey]);

  return metrics;
};
