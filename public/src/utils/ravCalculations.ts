import { Transaction, Recurrence, RavConfig } from '../types/banking.types';
import type { RavConfigFormValues } from '../lib/schemas/forms';
import { getPeriodKey, getAmountForPeriod, isSettled } from './recurrenceEngine';
import { resolveRecurrencePeriods } from './resolveRecurrencePeriods';
import { PATRIMONIAL_FLOW_CATEGORY_ALIASES } from '../constants/transactionFlowCategories';
import { categoryKey } from './budgetHelpers';

export interface DerivedRav {
  reste: number;
  revenuRef: number;
  totalDep: number;
  provisions: number;
  modeLabel: 'FIXE' | 'BUDGET' | 'DYNAMIQUE';
  pct: number;
}

export const DEFAULT_EXCLUDED_EXPENSES = new Set([...PATRIMONIAL_FLOW_CATEGORY_ALIASES, 'Prêt']);

export const EMPTY_RAV_CONFIG: RavConfigFormValues = {
  revenu_mensuel_net: null,
  provision_salaires: {},
  revenu_categories: [],
  depense_categories: [],
  included_accounts: [],
};

/** Config RAV Firestore → valeurs complètes (migre l'ancien `revenu_mensuel_net` en provision salaire). */
export function toRavFormConfig(ravConfig: RavConfig | null): RavConfigFormValues {
  if (!ravConfig) return EMPTY_RAV_CONFIG;
  const next: RavConfigFormValues = {
    revenu_mensuel_net: ravConfig.revenu_mensuel_net ?? null,
    provision_salaires: ravConfig.provision_salaires ?? {},
    revenu_categories: ravConfig.revenu_categories ?? [],
    depense_categories: ravConfig.depense_categories ?? [],
    included_accounts: ravConfig.included_accounts ?? [],
  };
  if (
    ravConfig.revenu_mensuel_net &&
    (!ravConfig.provision_salaires || Object.keys(ravConfig.provision_salaires).length === 0)
  ) {
    next.provision_salaires = {
      nico: { montant: ravConfig.revenu_mensuel_net, categorie: 'Salaire Nico' },
    };
  }
  return next;
}

const counted = (tx: Transaction) =>
  tx.bankStatus !== 'cancelled' &&
  (!!tx.pointe || tx.source === 'enable_banking' || !!tx.bankStatus);

export function normCategory(value: string): string {
  return (value || '').trim().toLocaleLowerCase('fr');
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
 * Vérifie si une catégorie ou libellé fait partie du périmètre des revenus autorisés.
 * Si une liste explicite est fournie dans la configuration du RAV, elle fait foi.
 * Sinon, repli par défaut sur les catégories Salaires et CAF uniquement.
 */
export function isAllowedIncomeCategory(
  catOrLabel: string,
  configuredCategories?: string[] | null,
): boolean {
  if (!catOrLabel) return false;
  const explicit = (configuredCategories || []).map((c) => c.trim()).filter(Boolean);
  if (explicit.length > 0) {
    return explicit.some((c) => matchesIncomeCategory(c, catOrLabel));
  }
  return isSalaryOrCafCategory(catOrLabel);
}

export interface ReferenceIncomeConfig {
  provision_salaires?: Record<string, { montant?: number; categorie?: string }> | null;
  revenu_categories?: string[] | null;
}

/**
 * Calcule le revenu de référence mensuel sans double comptage :
 * - N'admet STRICTEMENT que les catégories autorisées (Salaires et CAF / revenu_categories).
 * - Les provisions salaires manuelles (ex: Salaire Nico, Salaire Gwen) ont priorité.
 * - Les récurrences actives positives de ces mêmes catégories ne sont ajoutées QUE si
 *   elles ne sont pas déjà couvertes par une provision salaire (ex: la CAF s'ajoute,
 *   mais un Salaire Nico déjà provisionné n'est pas compté deux fois).
 */
export function computeReferenceIncome(
  cfg: ReferenceIncomeConfig | null | undefined,
  recurrences: Recurrence[] = [],
  monthKey?: string,
): number {
  const allowedIncomeFilter = (catOrLabel: string) =>
    isAllowedIncomeCategory(catOrLabel, cfg?.revenu_categories);

  const coveredCategories: string[] = [];
  let totalSalaries = 0;

  // 1. Provisions manuelles de salaires
  const salaryProvisions = Object.values(cfg?.provision_salaires ?? {});
  for (const prov of salaryProvisions) {
    const provAmount = Number(prov?.montant) || 0;
    if (provAmount <= 0) continue;
    const provCategory = prov?.categorie || 'Salaire';
    if (!allowedIncomeFilter(provCategory)) continue;

    totalSalaries += provAmount;
    coveredCategories.push(provCategory);
  }

  // 2. Récurrences actives positives
  const activeIncomeRecurrences = recurrences.filter((r) => r.active && r.expectedAmount > 0);

  let totalRecurringIncomes = 0;
  for (const r of activeIncomeRecurrences) {
    const cat = r.category || '';
    const label = r.label || '';

    // Doit être un revenu autorisé (Salaires, CAF)
    if (!allowedIncomeFilter(cat) && !allowedIncomeFilter(label)) {
      continue;
    }

    // Déduplication anti double comptage
    const alreadyCovered = coveredCategories.some(
      (cov) => matchesIncomeCategory(cov, cat) || matchesIncomeCategory(cov, label),
    );
    if (alreadyCovered) {
      continue;
    }

    const amount = monthKey
      ? Math.abs(getAmountForPeriod(r, monthKey))
      : Math.abs(r.expectedAmount);

    totalRecurringIncomes += amount;
    coveredCategories.push(cat || label);
  }

  return totalSalaries + totalRecurringIncomes;
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

export interface RecurringProvisionsOptions {
  categoryFilter?: (cat: string) => boolean;
  includedAccounts?: string[];
  referenceDate?: Date;
  checkPastMonth?: boolean;
}

/**
 * Provisions signées (négatives pour les dépenses, positives pour les revenus)
 * des récurrences actives d'un sens donné, pour le mois courant. Provisionné
 * uniquement si la période courante n'est ni payée ni ignorée (évite de
 * compter deux fois une charge déjà pointée ce mois-ci).
 * Pour un mois passé clôturé (avec checkPastMonth), retourne 0.
 */
export function getRecurringProvisions(
  monthKey: string,
  txs: Transaction[],
  recurrences: Recurrence[],
  movementType: 'expense' | 'income',
  options?: RecurringProvisionsOptions,
): number {
  const today = options?.referenceDate || new Date();
  if (options?.checkPastMonth) {
    const currentMonthKey = today.toISOString().slice(0, 7);
    if (monthKey < currentMonthKey) {
      return 0;
    }
  }

  const isExpense = movementType === 'expense';

  const activeOfType = recurrences.filter((r) => {
    if (!r.active) return false;
    if (isExpense ? r.expectedAmount >= 0 : r.expectedAmount <= 0) return false;
    if (options?.categoryFilter && !options.categoryFilter(r.category || '')) return false;
    const recAccount =
      (r as { account?: string; compte?: string }).account ||
      (r as { account?: string; compte?: string }).compte;
    if (
      options?.includedAccounts &&
      options.includedAccounts.length > 0 &&
      recAccount &&
      !options.includedAccounts.includes(recAccount)
    ) {
      return false;
    }
    return true;
  });

  const periodKey = getPeriodKey(`${monthKey}-01`);
  const periodTxs = txs.filter(
    (t) => counted(t) && (t.moisAffectation || t.date || '').slice(0, 7) === monthKey,
  );
  const resolved = resolveRecurrencePeriods(recurrences, periodKey, periodTxs, today);
  return activeOfType.reduce((sum, r) => {
    const state = resolved.get(r.id)!;
    // `isSettled` couvre approved ET matched : dans les deux cas la transaction
    // pointée est déjà comptée dans totalExpenses, la provisionner en plus
    // reviendrait à la compter deux fois.
    if (isSettled(state.state) || state.state === 'skipped') return sum;
    return sum + state.effectiveAmount;
  }, 0);
}

export interface RavContext {
  monthKey: string;
  txList: Transaction[];
  recurrences: Recurrence[];
  envelopeKeys?: Set<string>;
  envelopeProvision?: number;
  referenceDate?: Date;
}

/** Calcule le Reste-À-Vivre dérivé d'une configuration et d'un contexte transactionnel. */
export function computeDerivedRav(cfg: RavConfigFormValues, ctx: RavContext): DerivedRav {
  const { monthKey, txList, recurrences, envelopeKeys, envelopeProvision = 0, referenceDate } = ctx;
  const expenseMatches = categoryMatcher(cfg.depense_categories, DEFAULT_EXCLUDED_EXPENSES);
  const isEnvelopeCat = (cat: string) => Boolean(envelopeKeys?.has(categoryKey(cat)));
  const isExpenseIncluded = (cat: string) => expenseMatches(cat) && !isEnvelopeCat(cat);

  const netByCategory: Record<string, number> = {};

  txList.forEach((tx) => {
    const isRightMonth = (tx.moisAffectation || tx.date || '').slice(0, 7) === monthKey;
    const isAccountIncluded =
      cfg.included_accounts.length > 0 ? cfg.included_accounts.includes(tx.compte || '') : true;

    if (isRightMonth && counted(tx) && isAccountIncluded) {
      const amount = tx.montant ?? 0;
      const cat = (tx.categorie || '').trim();
      if (isExpenseIncluded(cat)) {
        const key = categoryKey(cat);
        netByCategory[key] = (netByCategory[key] || 0) + amount;
      }
    }
  });

  let totalExpenses = 0;
  for (const net of Object.values(netByCategory)) {
    if (net < 0) totalExpenses += net;
  }

  const today = referenceDate || new Date();
  const currentMonthKey = today.toISOString().slice(0, 7);
  const isPastMonth = monthKey < currentMonthKey;

  const expenseProvisions = getRecurringProvisions(monthKey, txList, recurrences, 'expense', {
    categoryFilter: isExpenseIncluded,
    includedAccounts: cfg.included_accounts,
    referenceDate: today,
    checkPastMonth: true,
  });
  const revenuRef = computeReferenceIncome(cfg, recurrences, monthKey);
  const monthlyEnvelope = isPastMonth ? 0 : Math.max(0, envelopeProvision);
  const totalProvisions = expenseProvisions - monthlyEnvelope;
  // totalProvisions est négatif (dépenses + provision annuelle) : l'additionner le retranche bien du reste.
  const reste = revenuRef - Math.abs(totalExpenses) + totalProvisions;
  const pct = revenuRef > 0 ? Math.max(0, Math.min(100, (reste / revenuRef) * 100)) : 0;

  return {
    reste,
    revenuRef,
    totalDep: totalExpenses,
    provisions: totalProvisions,
    modeLabel: 'FIXE',
    pct,
  };
}
