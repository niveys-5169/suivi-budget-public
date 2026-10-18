import { useMemo } from 'react';
import { useBalances } from './useBalances';
import { useGlobalData } from '../context/GlobalDataContext';
import { useTransactionContext } from '../context/TransactionContext';
import { useBudget } from './useBudget';
import { getAmountForPeriod, isSettled } from '../utils/recurrenceEngine';
import { resolveRecurrencePeriods } from '../utils/resolveRecurrencePeriods';
import { categoryKey } from '../utils/budgetHelpers';
import type { Recurrence, Transaction, BudgetBase, RavConfig } from '../types/banking.types';

export interface SafeToSpendResult {
  checkingTotal: number;
  upcomingIncome: number;
  projectedLiquidity: number;
  upcomingFixedCharges: number;
  remainingBudgets: number;
  totalCommitted: number;
  safeToSpend: number;
  dailyPace: number;
  daysRemainingInMonth: number;
  hasRecurrences: boolean;
  hasBudgets: boolean;
}

/**
 * Calcul pur du Reste-à-Vivre Réel (Safe-to-Spend).
 *
 * Liquidités disponibles d'ici la fin du mois =
 *   Solde bancaire actuel + Revenus & salaires attendus avant le 31
 *
 * Dépenses engagées d'ici la fin du mois =
 *   Charges fixes récurrentes restantes + Reste à dépenser sur les budgets variables
 *   (avec neutralisation anti-double comptage des charges déjà couvertes par une récurrence)
 *
 * Reste-à-Vivre = max(0, Liquidités disponibles - Dépenses engagées)
 */
export function calculateSafeToSpend(
  checkingTotal: number,
  recurrences: Recurrence[] = [],
  transactions: Transaction[] = [],
  budgets: BudgetBase[] = [],
  ravConfig: RavConfig | null = null,
  now: Date = new Date(),
): SafeToSpendResult {
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const currentDay = now.getDate();
  const totalDaysInMonth = monthEnd.getDate();
  const daysRemainingInMonth = Math.max(1, totalDaysInMonth - currentDay + 1);
  const periodKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const periodTxs = transactions.filter(
    (tx) => (tx.moisAffectation || tx.date || '').slice(0, 7) === periodKey,
  );

  // 1. REVENUS ATTENDUS (Entrées d'argent à venir d'ici la fin du mois)
  let upcomingIncome = 0;
  const positiveRecurrences = recurrences.filter((r) => r.active && r.expectedAmount > 0);
  const positiveRecLabels = new Set<string>();

  if (positiveRecurrences.length > 0) {
    const incomeStates = resolveRecurrencePeriods(positiveRecurrences, periodKey, periodTxs, now);

    for (const r of positiveRecurrences) {
      positiveRecLabels.add((r.label || '').toLowerCase());
      const state = incomeStates.get(r.id);
      // Si le revenu n'est pas encore crédité sur le compte bancaire
      if (!state || (!isSettled(state.state) && state.state !== 'skipped')) {
        const amount = Math.abs(getAmountForPeriod(r, periodKey));
        upcomingIncome += amount;
      }
    }
  }

  // Ajout des provisions salaires (du RAV) non déjà couvertes par une récurrence
  const salaryProvisions = Object.values(ravConfig?.provision_salaires ?? {});
  for (const prov of salaryProvisions) {
    const provAmount = Number(prov?.montant) || 0;
    if (provAmount <= 0) continue;

    const provCategory = (prov?.categorie || 'Salaire').toLowerCase();
    // Évite de compter deux fois si déjà dans les récurrences
    const alreadyInRecurrences = Array.from(positiveRecLabels).some(
      (lbl) => lbl.includes(provCategory) || provCategory.includes(lbl),
    );
    if (alreadyInRecurrences) continue;

    // Vérifie si le salaire est déjà crédité ce mois-ci sur le compte
    const alreadyReceived = periodTxs.some(
      (tx) =>
        (tx.montant ?? 0) > 0 && Math.abs((tx.montant ?? 0) - provAmount) / provAmount <= 0.25,
    );

    if (!alreadyReceived) {
      upcomingIncome += provAmount;
    }
  }

  // 2. CHARGES FIXES RESTANTES (Dépenses récurrentes à prélever)
  const activeExpenseRecurrences = recurrences.filter((r) => r.active && r.expectedAmount < 0);

  let upcomingFixedCharges = 0;
  const fixedChargesByCatKey = new Map<string, number>();

  if (activeExpenseRecurrences.length > 0) {
    const expenseStates = resolveRecurrencePeriods(
      activeExpenseRecurrences,
      periodKey,
      periodTxs,
      now,
    );

    for (const r of activeExpenseRecurrences) {
      const state = expenseStates.get(r.id);
      if (!state || isSettled(state.state) || state.state === 'skipped') {
        continue;
      }
      const amount = Math.abs(getAmountForPeriod(r, periodKey));
      upcomingFixedCharges += amount;

      const catK = categoryKey(r.category);
      fixedChargesByCatKey.set(catK, (fixedChargesByCatKey.get(catK) || 0) + amount);
    }
  }

  // 3. ENVELOPPES BUDGÉTAIRES VARIABLES (Reste à dépenser)
  const activeExpenseBudgets = budgets.filter(
    (b) => b.actif !== false && !b.isIncome && b.type !== 'revenu',
  );

  const spentByCatKey = new Map<string, number>();
  periodTxs.forEach((tx) => {
    const amount = tx.montant ?? 0;
    if (amount < 0) {
      const catK = categoryKey(tx.categorie || 'Autre');
      spentByCatKey.set(catK, (spentByCatKey.get(catK) || 0) + Math.abs(amount));
    }
  });

  let remainingBudgets = 0;
  for (const b of activeExpenseBudgets) {
    const catK = categoryKey(b.categorie);
    const budgetAmount = Math.max(0, b.montant ?? 0);
    const spentAmount = spentByCatKey.get(catK) || 0;
    const rawRemaining = Math.max(0, budgetAmount - spentAmount);

    // Déduit la charge fixe déjà comptabilisée dans les récurrences pour cette catégorie
    const fixedAlreadyCounted = fixedChargesByCatKey.get(catK) || 0;
    const netRemaining = Math.max(0, rawRemaining - fixedAlreadyCounted);

    remainingBudgets += netRemaining;
  }

  const projectedLiquidity = checkingTotal + upcomingIncome;
  const totalCommitted = upcomingFixedCharges + remainingBudgets;
  const safeToSpend = Math.max(0, projectedLiquidity - totalCommitted);
  const dailyPace = daysRemainingInMonth > 0 ? safeToSpend / daysRemainingInMonth : safeToSpend;

  return {
    checkingTotal,
    upcomingIncome,
    projectedLiquidity,
    upcomingFixedCharges,
    remainingBudgets,
    totalCommitted,
    safeToSpend,
    dailyPace,
    daysRemainingInMonth,
    hasRecurrences: activeExpenseRecurrences.length > 0 || positiveRecurrences.length > 0,
    hasBudgets: activeExpenseBudgets.length > 0,
  };
}

/**
 * Hook exposant le Safe-to-Spend calculé en direct à partir des soldes,
 * récurrences actives, transactions du mois, budgets et provisions salaires.
 */
export const useSafeToSpend = (): SafeToSpendResult => {
  const { checkingTotal = 0 } = useBalances() || {};
  const { recurrences = [], ravConfig = null } = useGlobalData() || {};
  const { transactions = [] } = useTransactionContext() || {};
  const { budgets = [] } = useBudget();

  return useMemo(() => {
    return calculateSafeToSpend(checkingTotal, recurrences, transactions, budgets, ravConfig);
  }, [checkingTotal, recurrences, transactions, budgets, ravConfig]);
};
