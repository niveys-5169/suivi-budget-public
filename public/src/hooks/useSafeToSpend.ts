import { useContext, useMemo } from 'react';
import { useBalances } from './useBalances';
import { useGlobalData } from '../context/GlobalDataContext';
import { TransactionContext } from '../context/TransactionContext';
import { BudgetContext } from '../context/BudgetContext';
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

import {
  isSalaryOrCafCategory,
  matchesIncomeCategory,
  isAllowedIncomeCategory,
} from '../utils/ravCalculations';

export { isSalaryOrCafCategory, matchesIncomeCategory, isAllowedIncomeCategory };

/**
 * Calcul pur du Reste-à-Vivre Réel (Safe-to-Spend).
 *
 * Liquidités disponibles d'ici la fin du mois =
 *   Solde bancaire actuel + Salaires et CAF attendus avant le 31
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

  // 1. REVENUS ATTENDUS : Uniquement les salaires et la CAF déclarés (non encore reçus ce mois-ci)
  // Neutralise toutes les autres récurrences (virements internes, épargne, remboursements, etc.)
  interface IncomeTarget {
    category: string;
    expectedAmount: number;
    recurrenceId?: string;
  }
  const incomeTargets = new Map<string, IncomeTarget>();

  const allowedIncomeFilter = (catOrLabel: string) =>
    isAllowedIncomeCategory(catOrLabel, ravConfig?.revenu_categories);

  const findMatchingTarget = (catOrLabel: string): IncomeTarget | undefined => {
    for (const target of incomeTargets.values()) {
      if (matchesIncomeCategory(target.category, catOrLabel)) return target;
    }
    return undefined;
  };

  // A. Budgets actifs pour Salaires et CAF
  budgets
    .filter((b) => b.actif !== false && allowedIncomeFilter(b.categorie || b.nom))
    .forEach((b) => {
      const amount = Math.max(0, b.montant ?? 0);
      if (amount > 0) {
        const cat = b.categorie || b.nom;
        incomeTargets.set(categoryKey(cat), {
          category: cat,
          expectedAmount: amount,
        });
      }
    });

  // B. Provisions de salaires configurées dans le RAV (si non déjà renseignées dans les budgets)
  const salaryProvisions = Object.values(ravConfig?.provision_salaires ?? {});
  for (const prov of salaryProvisions) {
    const provAmount = Number(prov?.montant) || 0;
    if (provAmount <= 0) continue;
    const provCategory = prov?.categorie || 'Salaire';
    if (!allowedIncomeFilter(provCategory)) continue;

    const existing = findMatchingTarget(provCategory);
    if (!existing) {
      incomeTargets.set(categoryKey(provCategory), {
        category: provCategory,
        expectedAmount: provAmount,
      });
    }
  }

  // C. Récurrences actives de type Salaire ou CAF uniquement (si non déjà couvertes)
  const salaryOrCafRecurrences = recurrences.filter(
    (r) =>
      r.active &&
      r.expectedAmount > 0 &&
      (allowedIncomeFilter(r.category || '') || allowedIncomeFilter(r.label || '')),
  );
  if (salaryOrCafRecurrences.length > 0) {
    const recurrenceStates = resolveRecurrencePeriods(
      salaryOrCafRecurrences,
      periodKey,
      periodTxs,
      now,
    );

    for (const r of salaryOrCafRecurrences) {
      const cat = allowedIncomeFilter(r.category || '')
        ? r.category || 'Salaire'
        : r.label || 'Salaire';
      const key = categoryKey(cat);
      const state = recurrenceStates.get(r.id);
      const isAlreadySettled = state && isSettled(state.state);
      const existing = findMatchingTarget(cat) || findMatchingTarget(r.label || '');

      if (!existing) {
        const amount = Math.abs(getAmountForPeriod(r, periodKey));
        if (amount > 0 && !isAlreadySettled) {
          incomeTargets.set(key, {
            category: cat,
            expectedAmount: amount,
            recurrenceId: r.id,
          });
        }
      } else if (isAlreadySettled) {
        existing.recurrenceId = r.id;
      }
    }
  }

  // Calcul du montant restant à percevoir pour chaque cible de Salaire et CAF
  let upcomingIncome = 0;
  for (const target of incomeTargets.values()) {
    if (target.recurrenceId) {
      const state = resolveRecurrencePeriods(
        recurrences.filter((r) => r.id === target.recurrenceId),
        periodKey,
        periodTxs,
        now,
      ).get(target.recurrenceId);
      if (state && (isSettled(state.state) || state.state === 'skipped')) {
        continue;
      }
    }

    const alreadyReceived = periodTxs
      .filter((tx) => {
        const amount = tx.montant ?? 0;
        if (amount <= 0) return false;
        return (
          matchesIncomeCategory(target.category, tx.categorie || '') ||
          matchesIncomeCategory(target.category, tx.libelle || '')
        );
      })
      .reduce((sum, tx) => sum + (tx.montant ?? 0), 0);

    const remaining = Math.max(0, target.expectedAmount - alreadyReceived);
    upcomingIncome += remaining;
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
    const catK = categoryKey(tx.categorie || 'Autre');
    spentByCatKey.set(catK, (spentByCatKey.get(catK) || 0) - amount);
  });

  let remainingBudgets = 0;
  for (const b of activeExpenseBudgets) {
    const catK = categoryKey(b.categorie);
    const rawBudget = Math.max(0, b.montant ?? 0);
    const budgetAmount = b.type === 'annuel' ? rawBudget / 12 : rawBudget;
    const spentAmount = Math.max(0, spentByCatKey.get(catK) || 0);
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
    hasRecurrences: activeExpenseRecurrences.length > 0 || salaryOrCafRecurrences.length > 0,
    hasBudgets: activeExpenseBudgets.length > 0 || incomeTargets.size > 0,
  };
}

/**
 * Hook exposant le Safe-to-Spend calculé en direct à partir des soldes,
 * récurrences actives, transactions du mois, budgets et provisions salaires.
 */
export const useSafeToSpend = (): SafeToSpendResult => {
  const { checkingTotal = 0 } = useBalances() || {};
  const { recurrences = [], ravConfig = null } = useGlobalData() || {};
  const txContext = useContext(TransactionContext);
  const transactions = txContext?.transactions;
  const budgetContext = useContext(BudgetContext);
  const budgets = budgetContext?.budgets;

  return useMemo(() => {
    return calculateSafeToSpend(
      checkingTotal,
      recurrences,
      transactions || [],
      budgets || [],
      ravConfig,
    );
  }, [checkingTotal, recurrences, transactions, budgets, ravConfig]);
};
