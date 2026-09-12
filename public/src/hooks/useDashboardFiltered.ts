import { useMemo } from 'react';
import { Transaction } from '../types/banking.types';
import { DashboardPeriod } from './useDashboard';

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Résout la fenêtre [start, end] (ISO YYYY-MM-DD) d'une période de dashboard.
 * Pour `current_month` et `all_time`, les bornes sont vides : le filtrage se
 * fait alors respectivement par moisAffectation ou sans contrainte de date.
 * Fonction pure (l'horloge est injectable pour la testabilité).
 */
export const resolveDashboardRange = (
  period: DashboardPeriod,
  customRange: DateRange,
  now: Date = new Date(),
): DateRange => {
  const year = now.getFullYear();
  if (period === 'year_to_date') {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return { start: `${year}-01-01`, end: `${year}-${m}-${d}` };
  }
  if (period === 'last_year') {
    return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  }
  if (period === 'custom') {
    return { start: customRange.start, end: customRange.end };
  }
  return { start: '', end: '' };
};

/**
 * Filtre les transactions par catégories sélectionnées + période.
 * Extrait de useDashboard pour être consommé/testé isolément et n'être
 * recalculé que sur changement réel d'une de ses entrées.
 */
export const useDashboardFiltered = (
  transactions: Transaction[],
  period: DashboardPeriod,
  monthKey: string,
  customRange: DateRange,
  selectedCategories: ReadonlySet<string>,
): Transaction[] =>
  useMemo(() => {
    const { start, end } = resolveDashboardRange(period, customRange);

    return transactions.filter((t) => {
      const cat = t.categorie || 'Non catégorisé';
      if (selectedCategories.size > 0 && !selectedCategories.has(cat)) return false;

      if (period === 'current_month') {
        const assignedMonth = (t.moisAffectation || t.date || '').slice(0, 7);
        return assignedMonth === monthKey;
      }

      if (start && end) {
        return Boolean(t.date) && t.date >= start && t.date <= end;
      }

      return true; // all_time
    });
  }, [transactions, period, monthKey, customRange, selectedCategories]);
