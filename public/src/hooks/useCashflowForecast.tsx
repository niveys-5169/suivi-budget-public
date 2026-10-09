import { useMemo } from 'react';
import { useBalances } from './useBalances';
import { useGlobalData } from '../context/GlobalDataContext';
import {
  getAmountForPeriod,
  getUpcomingOccurrences,
  getDayOfMonth,
  isSettled,
} from '../utils/recurrenceEngine';
import { computeCashflowForecast, type CashflowForecast } from '../utils/computeCashflowForecast';
import type { Recurrence } from '../types/banking.types';
import type { Transaction } from '../types/banking.types';
import { useTransactionContext } from '../context/TransactionContext';
import { resolveRecurrencePeriods } from '../utils/resolveRecurrencePeriods';

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

/**
 * Projette le solde bancaire sur l'horizon demandé à partir des récurrences
 * actives (dépenses et revenus, toutes fréquences) et des revenus déclarés
 * dans le RAV (`provision_salaires`, non couverts par une récurrence).
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

    const recurrencesIncomes = mapActiveRecurrences(
      recurrences,
      'income',
      startDate,
      horizonDays,
      transactions,
    );

    // Revenus déclarés dans le RAV non déjà couverts par une récurrence
    // (même libellé/catégorie) — évite de compter deux fois le même salaire.
    const ravIncomes = Object.entries(ravConfig?.provision_salaires ?? {})
      .filter(([, p]) => (Number(p?.montant) || 0) > 0)
      .map(([k, p]) => ({
        key: k,
        label: p.categorie || 'Revenu',
        amount: Number(p.montant) || 0,
        dayOfMonth: 1,
      }))
      .filter((ravInc) => {
        const normalizedRavLabel = ravInc.label.toLowerCase();
        return !recurrencesIncomes.some((recInc) => {
          const normalizedRecLabel = recInc.label.toLowerCase();
          const normalizedRecCategory = (recInc.category || '').toLowerCase();
          return (
            normalizedRecLabel.includes(normalizedRavLabel) ||
            normalizedRavLabel.includes(normalizedRecLabel) ||
            normalizedRecCategory.includes(normalizedRavLabel) ||
            normalizedRavLabel.includes(normalizedRecCategory) ||
            recInc.key === ravInc.key
          );
        });
      });

    const recurringIncomes = [
      ...recurrencesIncomes.map((r) => ({
        key: r.key,
        label: r.label,
        amount: r.amount,
        dayOfMonth: r.dayOfMonth,
        occurrenceDates: r.occurrenceDates,
      })),
      ...ravIncomes,
    ];

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
