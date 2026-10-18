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
 * Vérifie si une catégorie correspond aux Salaires ou à la CAF.
 */
export function isSalaryOrCafCategory(catName: string | null | undefined): boolean {
  if (!catName) return false;
  const k = categoryKey(catName);
  return k.includes('salaire') || k.includes('caf') || k.includes('allocations familiales');
}

/**
 * Compare deux catégories de revenu pour éviter de mélanger deux salaires distincts
 * (ex: Salaire Nico vs Salaire Gwen) tout en autorisant les variantes de casse/accents.
 */
export function matchesIncomeCategory(itemCat: string, txCatOrLabel: string): boolean {
  const k1 = categoryKey(itemCat);
  const k2 = categoryKey(txCatOrLabel);
  if (!k1 || !k2) return false;
  if (k1 === k2) return true;

  if (k1.includes('caf') && k2.includes('caf')) return true;

  if (k1.includes('salaire') && k2.includes('salaire')) {
    const words1 = k1.split(/\s+/).filter((w) => w !== 'salaire');
    const words2 = k2.split(/\s+/).filter((w) => w !== 'salaire');
    if (words1.length > 0 && words2.length > 0) {
      return words1.some((w) => words2.includes(w));
    }
    return true;
  }

  return false;
}

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

  // 1. REVENUS ATTENDUS : Uniquement les budgets Salaires et la CAF (non encore reçus ce mois-ci)
  // Neutralise toutes les autres récurrences (virements internes, épargne, remboursements, etc.)
  interface IncomeTarget {
    category: string;
    expectedAmount: number;
    recurrenceId?: string;
  }
  const incomeTargets = new Map<string, IncomeTarget>();

  // A. Budgets actifs pour Salaires et CAF
  budgets
    .filter((b) => b.actif !== false && isSalaryOrCafCategory(b.categorie || b.nom))
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
    const key = categoryKey(provCategory);
    if (!incomeTargets.has(key)) {
      incomeTargets.set(key, {
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
      (isSalaryOrCafCategory(r.category) || isSalaryOrCafCategory(r.label)),
  );
  if (salaryOrCafRecurrences.length > 0) {
    const recurrenceStates = resolveRecurrencePeriods(
      salaryOrCafRecurrences,
      periodKey,
      periodTxs,
      now,
    );

    for (const r of salaryOrCafRecurrences) {
      const cat = isSalaryOrCafCategory(r.category)
        ? r.category || 'Salaire'
        : r.label || 'Salaire';
      const key = categoryKey(cat);
      const state = recurrenceStates.get(r.id);
      const isAlreadySettled = state && isSettled(state.state);

      if (!incomeTargets.has(key)) {
        const amount = Math.abs(getAmountForPeriod(r, periodKey));
        if (amount > 0 && !isAlreadySettled) {
          incomeTargets.set(key, {
            category: cat,
            expectedAmount: amount,
            recurrenceId: r.id,
          });
        }
      } else if (isAlreadySettled) {
        const existing = incomeTargets.get(key)!;
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
  const { transactions = [] } = useTransactionContext() || {};
  const { budgets = [] } = useBudget();

  return useMemo(() => {
    return calculateSafeToSpend(checkingTotal, recurrences, transactions, budgets, ravConfig);
  }, [checkingTotal, recurrences, transactions, budgets, ravConfig]);
};
