import { useMemo } from 'react';
import { useBalances } from './useBalances';
import { useGlobalData } from '../context/GlobalDataContext';
import { getUpcomingOccurrences, getDayOfMonth } from '../utils/recurrenceEngine';
import { computeCashflowForecast, type CashflowForecast } from '../utils/computeCashflowForecast';
import type { Recurrence } from '../types/banking.types';

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
): MappedRecurrence[] {
  const filtered = recurrences.filter(
    (r) => r.active && (sign === 'income' ? r.expectedAmount > 0 : r.expectedAmount < 0),
  );

  const mapped = filtered.map((r) => ({
    key: r.id,
    label: r.label,
    category: r.category,
    amount: Math.abs(r.expectedAmount),
    dayOfMonth: getDayOfMonth(r),
    occurrenceDates: getUpcomingOccurrences(r, startDate, horizonDays).map((o) => o.date),
  }));

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
  horizonDays: ForecastHorizon = 30,
  safetyThreshold = 0,
): CashflowForecast => {
  const { checkingTotal } = useBalances();
  const { ravConfig, recurrences = [] } = useGlobalData();

  return useMemo(() => {
    const startDate = new Date();

    const recurringExpenses = mapActiveRecurrences(
      recurrences,
      'expense',
      startDate,
      horizonDays,
    ).map((r) => ({
      key: r.key,
      label: r.label,
      avgAmount: r.amount,
      dayOfMonth: r.dayOfMonth,
      occurrenceDates: r.occurrenceDates,
    }));

    const recurrencesIncomes = mapActiveRecurrences(recurrences, 'income', startDate, horizonDays);

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
  }, [checkingTotal, ravConfig, recurrences, horizonDays, safetyThreshold]);
};
