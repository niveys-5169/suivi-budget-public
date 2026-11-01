import { useMemo } from 'react';
import { useBalances } from './useBalances';
import { useGlobalData } from '../context/GlobalDataContext';
import {
  getAmountForPeriod,
  getUpcomingOccurrences,
  getDayOfMonth,
  isSettled,
} from '../utils/recurrenceEngine';
import {
  computeCashflowForecast,
  type CashflowForecast,
  type ForecastRecurringIncome,
} from '../utils/computeCashflowForecast';
import type { RavConfig, Recurrence } from '../types/banking.types';
import type { Transaction } from '../types/banking.types';
import { useTransactionContext } from '../context/TransactionContext';
import { resolveRecurrencePeriods } from '../utils/resolveRecurrencePeriods';
import { isAllowedIncomeCategory, matchesIncomeCategory } from '../utils/ravCalculations';

export type ForecastHorizon = 30 | 60 | 90;

interface MappedRecurrence {
  key: string;
  label: string;
  category?: string;
  amount: number; // valeur absolue
  dayOfMonth: number;
  occurrenceDates: string[];
}

/**
 * Récurrences actives d'un sens donné (revenu/dépense), avec leurs échéances
 * dans l'horizon. Déduplique les récurrences strictement identiques (catégorie
 * + montant + jour) : filet de sécurité pour d'éventuels doublons de saisie,
 * sans coût quand il n'y en a pas.
 */
function mapActiveRecurrences(
  recurrences: Recurrence[],
  sign: 'income' | 'expense',
  startDate: Date,
  horizonDays: number,
  transactions: Transaction[],
): MappedRecurrence[] {
  const filtered = recurrences.filter(
    (r) => r.active && (sign === 'income' ? r.expectedAmount > 0 : r.expectedAmount < 0),
  );

  // Un réajustement peut tomber au milieu de l'horizon : les échéances sont
  // regroupées par montant de leur période (une entrée par montant distinct).
  const periods = new Map<string, ReturnType<typeof resolveRecurrencePeriods>>();
  const mapped = filtered.flatMap((r) => {
    const byAmount = new Map<number, string[]>();
    for (const o of getUpcomingOccurrences(r, startDate, horizonDays)) {
      if (!periods.has(o.periodKey))
        periods.set(
          o.periodKey,
          resolveRecurrencePeriods(
            recurrences,
            o.periodKey,
            transactions.filter(
              (tx) => (tx.moisAffectation || tx.date).slice(0, 7) === o.periodKey,
            ),
            startDate,
          ),
        );
      const state = periods.get(o.periodKey)!.get(r.id)!;
      if (isSettled(state.state) || state.state === 'skipped') continue;
      const amount = Math.abs(getAmountForPeriod(r, o.periodKey));
      byAmount.set(amount, [...(byAmount.get(amount) ?? []), o.date]);
    }
    return Array.from(byAmount, ([amount, occurrenceDates]) => ({
      key: r.id,
      label: r.label,
      category: r.category,
      amount,
      dayOfMonth: getDayOfMonth(r),
      occurrenceDates,
    }));
  });

  const deduped = new Map<string, MappedRecurrence>();
  for (const r of mapped) {
    const dedupKey = `${r.label.toLowerCase()}-${(r.category || '').toLowerCase()}-${r.amount}-${r.dayOfMonth}`;
    if (!deduped.has(dedupKey)) deduped.set(dedupKey, r);
  }
  return Array.from(deduped.values()).filter((r) => r.occurrenceDates.length > 0);
}

export interface IncomeSchedule {
  key: string;
  label: string;
  category?: string;
  dayOfMonth: number;
  /** Échéances à venir non encore perçues dans l'horizon. */
  occurrenceDates: string[];
}

/**
 * Revenus de la projection : uniquement les salaires déclarés dans le RAV
 * (`provision_salaires`), toujours au montant déclaré — jamais au montant
 * appris des versements passés. Une récurrence correspondante (même clé ou
 * même catégorie/libellé) ne fournit que le calendrier (dates à venir, mois
 * déjà perçus exclus) ; sans récurrence, repli sur le 1ᵉʳ du mois.
 */
export function buildDeclaredSalaryIncomes(
  provisionSalaires: RavConfig['provision_salaires'],
  revenuCategories: string[] | null | undefined,
  incomeSchedules: IncomeSchedule[],
): ForecastRecurringIncome[] {
  return Object.entries(provisionSalaires ?? {})
    .map(([key, p]) => ({
      key,
      label: p?.categorie || 'Revenu',
      amount: Number(p?.montant) || 0,
    }))
    .filter((s) => s.amount > 0 && isAllowedIncomeCategory(s.label, revenuCategories))
    .map((salary) => {
      const matches = incomeSchedules.filter(
        (r) =>
          r.key === salary.key ||
          matchesIncomeCategory(r.category || '', salary.label) ||
          matchesIncomeCategory(r.label, salary.label),
      );
      const schedule = matches.find((r) => r.occurrenceDates.length > 0) ?? matches[0];
      return schedule
        ? { ...salary, dayOfMonth: schedule.dayOfMonth, occurrenceDates: schedule.occurrenceDates }
        : { ...salary, dayOfMonth: 1 };
    });
}

/**
 * Projette le solde bancaire sur l'horizon demandé à partir des récurrences
 * de dépense actives (toutes fréquences) et des seuls salaires déclarés dans
 * le RAV (`provision_salaires`) pour les revenus.
 */
export const useCashflowForecast = (
  horizonDays: number = 30,
  safetyThreshold = 0,
): CashflowForecast => {
  const { checkingTotal } = useBalances();
  const { ravConfig, recurrences = [] } = useGlobalData();
  const { transactions } = useTransactionContext();

  return useMemo(() => {
    const startDate = new Date();

    const recurringExpenses = mapActiveRecurrences(
      recurrences,
      'expense',
      startDate,
      horizonDays,
      transactions,
    ).map((r) => ({
      key: r.key,
      label: r.label,
      avgAmount: r.amount,
      dayOfMonth: r.dayOfMonth,
      occurrenceDates: r.occurrenceDates,
    }));

    // Dates à venir (non encore perçues) de chaque récurrence de revenu active.
    const mappedIncomes = mapActiveRecurrences(
      recurrences,
      'income',
      startDate,
      horizonDays,
      transactions,
    );
    const incomeSchedules = recurrences
      .filter((r) => r.active && r.expectedAmount > 0)
      .map((r) => ({
        key: r.id,
        label: r.label,
        category: r.category,
        dayOfMonth: getDayOfMonth(r),
        occurrenceDates: mappedIncomes
          .filter((m) => m.key === r.id)
          .flatMap((m) => m.occurrenceDates)
          .sort(),
      }));

    const recurringIncomes = buildDeclaredSalaryIncomes(
      ravConfig?.provision_salaires,
      ravConfig?.revenu_categories,
      incomeSchedules,
    );

    return computeCashflowForecast({
      startBalance: checkingTotal,
      startDate,
      horizonDays,
      recurringExpenses,
      recurringIncomes,
      safetyThreshold,
    });
  }, [checkingTotal, ravConfig, recurrences, horizonDays, safetyThreshold, transactions]);
};
