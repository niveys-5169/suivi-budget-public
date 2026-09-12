import { Transaction, Recurrence } from '../types/banking.types';
import type { RavConfigFormValues } from '../lib/schemas/forms';
import { getPeriodKey, computePeriodState, getApprovedTxIds, isSettled } from './recurrenceEngine';

export interface DerivedRav {
  reste: number;
  revenuRef: number;
  totalDep: number;
  provisions: number;
  modeLabel: 'FIXE' | 'BUDGET' | 'DYNAMIQUE';
  pct: number;
}

export const DEFAULT_EXCLUDED_EXPENSES = new Set([
  'Virements internes',
  'Virement interne',
  'Epargne',
  'Épargne',
  'Prêt',
  'Retrait Epargne',
  'Retraits epargne',
  'Retrait Épargne',
  'Retraits épargne',
]);

export function normCategory(value: string): string {
  return (value || '').trim().toLocaleLowerCase('fr');
}

export function categoryMatcher(
  selected: string[],
  defaultExcluded: Set<string>,
): (cat: string) => boolean {
  const normalizedSelected = new Set(selected.map(normCategory).filter(Boolean));
  if (normalizedSelected.size > 0) {
    return (cat: string) => normalizedSelected.has(normCategory(cat));
  }
  const normalizedExcluded = new Set(Array.from(defaultExcluded).map(normCategory));
  return (cat: string) => !normalizedExcluded.has(normCategory(cat));
}

/**
 * Provisions signées (négatives pour les dépenses, positives pour les revenus)
 * des récurrences actives d'un sens donné, pour le mois courant. Provisionné
 * uniquement si la période courante n'est ni payée ni ignorée (évite de
 * compter deux fois une charge déjà pointée ce mois-ci).
 */
export function getRecurringProvisions(
  monthKey: string,
  txs: Transaction[],
  recurrences: Recurrence[],
  movementType: 'expense' | 'income',
): number {
  const isExpense = movementType === 'expense';
  const today = new Date();

  const activeOfType = recurrences.filter(
    (r) => r.active && (isExpense ? r.expectedAmount < 0 : r.expectedAmount > 0),
  );
  const excludeTxIds = getApprovedTxIds(recurrences);

  return activeOfType.reduce((sum, r) => {
    const periodKey = getPeriodKey(`${monthKey}-01`);
    const periodTxs = txs.filter(
      (t) => !!t.pointe && (t.moisAffectation || t.date || '').slice(0, 7) === monthKey,
    );
    const state = computePeriodState(r, periodKey, periodTxs, today, excludeTxIds);
    // `isSettled` couvre approved ET matched : dans les deux cas la transaction
    // pointée est déjà comptée dans totalExpenses, la provisionner en plus
    // reviendrait à la compter deux fois.
    if (isSettled(state.state) || state.state === 'skipped') return sum;
    return sum + r.expectedAmount;
  }, 0);
}

interface RavContext {
  monthKey: string;
  txList: Transaction[];
  recurrences: Recurrence[];
}

/** Calcule le Reste-À-Vivre dérivé d'une configuration et d'un contexte transactionnel. */
export function computeDerivedRav(cfg: RavConfigFormValues, ctx: RavContext): DerivedRav {
  const { monthKey, txList, recurrences } = ctx;
  const expenseMatches = categoryMatcher(cfg.depense_categories, DEFAULT_EXCLUDED_EXPENSES);

  let totalExpenses = 0;

  txList.forEach((tx) => {
    const isRightMonth = (tx.moisAffectation || tx.date || '').slice(0, 7) === monthKey;
    const isAccountIncluded =
      cfg.included_accounts.length > 0 ? cfg.included_accounts.includes(tx.compte || '') : true;

    if (isRightMonth && !!tx.pointe && isAccountIncluded) {
      const amount = tx.montant ?? 0;
      const cat = (tx.categorie || '').trim();
      if (amount < 0 && expenseMatches(cat)) {
        totalExpenses += amount;
      }
    }
  });

  const totalDeclaredSalaries = Object.values(cfg.provision_salaires || {}).reduce(
    (s, p) => s + (Number(p.montant) || 0),
    0,
  );

  const recurringIncomeFixed = recurrences
    .filter((r) => r.active && r.expectedAmount > 0)
    .reduce((s, r) => s + r.expectedAmount, 0);

  const expenseProvisions = getRecurringProvisions(monthKey, txList, recurrences, 'expense');

  const revenuRef = totalDeclaredSalaries + recurringIncomeFixed;
  // expenseProvisions est négatif (dépenses) : l'additionner le retranche bien du reste.
  const reste = revenuRef - Math.abs(totalExpenses) + expenseProvisions;
  const pct = revenuRef > 0 ? Math.max(0, Math.min(100, (reste / revenuRef) * 100)) : 0;

  return {
    reste,
    revenuRef,
    totalDep: totalExpenses,
    provisions: expenseProvisions,
    modeLabel: 'FIXE',
    pct,
  };
}
