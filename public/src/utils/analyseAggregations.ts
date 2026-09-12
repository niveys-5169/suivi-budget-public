import type { Transaction } from '../types/banking.types';
import { classifyCategory, BUCKET_COLORS, BUCKET_ORDER } from './simplifiedBuckets';
import { getCategoryMeta } from '../constants/categoryMetadata';
import type {
  AnalyseTab,
  CategorySummary,
  SimplifiedBucketData,
} from '../components/analyse/analyseTypes';

export interface CategoryGroup {
  amount: number;
  count: number;
}

/** Forme minimale d'un budget consommée par les agrégats Analyse. */
export interface BudgetLike {
  categorie?: string;
  montant: number;
}

/** Forme d'un budget nécessaire aux agrégats de périmètre (revenus / dépenses budgétées). */
export interface ScopedBudgetLike {
  id: string;
  categorie?: string;
  montant?: number;
  actif?: boolean;
  isIncome?: boolean;
  type?: string;
}

const FALLBACK_COLORS = [
  '#38BDF8',
  '#818CF8',
  '#C084FC',
  '#F472B6',
  '#FB923C',
  '#FBBF24',
  '#34D399',
  '#2DD4BF',
  '#A3E635',
  '#F43F5E',
];

/** Construit la liste triée des catégories (couleur, %, dépassement budget). */
export function buildCategoryList(
  groups: Record<string, CategoryGroup>,
  visibleTotal: number,
  skipHidden: boolean,
  tab: AnalyseTab,
  opts: { hiddenCategories: Set<string>; budgets: BudgetLike[] },
): CategorySummary[] {
  const { hiddenCategories, budgets } = opts;
  return Object.entries(groups)
    .filter(([name, data]) => {
      // Bug 1.2: Filter out zero-amount categories to avoid "ghost" lines
      if (data.amount === 0) return false;
      return !skipHidden || !hiddenCategories.has(name);
    })
    .map(([name, data]) => {
      const meta = getCategoryMeta(name);
      let color = meta.color || '#71717A';
      if (color === '#71717A') {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        color = FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]!;
      }

      let isExceeded = false;
      const budgetEntry = budgets.find((b) => b.categorie === name);
      if (tab === 'sorties' && budgetEntry && data.amount > budgetEntry.montant) {
        isExceeded = true;
        color = '#EF4444';
      }

      const pct =
        visibleTotal > 0 && !hiddenCategories.has(name) ? (data.amount / visibleTotal) * 100 : 0;

      return {
        name,
        amount: data.amount,
        count: data.count,
        percentage: pct,
        color,
        isExceeded,
        budget: budgetEntry?.montant,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Détecte les catégories majoritairement créditrices (revenus) à partir de l'historique. */
export function detectIncomeCategories(transactions: Transaction[]): Set<string> {
  const cats = new Set<string>();

  const catStats: Record<string, { pos: number; neg: number }> = {};
  (transactions || []).forEach((t) => {
    const c = t.categorie;
    if (!c) return;
    if (!catStats[c]) catStats[c] = { pos: 0, neg: 0 };
    if ((t.montant || 0) > 0) catStats[c].pos++;
    else if ((t.montant || 0) < 0) catStats[c].neg++;
  });

  Object.entries(catStats).forEach(([c, stats]) => {
    if (stats.pos > 0 && stats.pos > stats.neg) {
      cats.add(c);
    }
  });
  return cats;
}

/** Regroupe les catégories en buckets simplifiés (Essentiel / Plaisir / Épargne / Imprévu). */
export function buildSimplifiedBuckets(allCategories: CategorySummary[]): SimplifiedBucketData[] {
  const bucketMap: Record<string, { amount: number; categories: CategorySummary[] }> = {
    Essentiel: { amount: 0, categories: [] },
    Plaisir: { amount: 0, categories: [] },
    Épargne: { amount: 0, categories: [] },
    Imprévu: { amount: 0, categories: [] },
  };

  allCategories.forEach((cat) => {
    const bucket = classifyCategory(cat.name);
    bucketMap[bucket]!.amount += cat.amount;
    bucketMap[bucket]!.categories.push(cat);
  });

  const totalSortiesAll = allCategories.reduce((s, c) => s + c.amount, 0);

  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    amount: bucketMap[bucket]!.amount,
    percentage: totalSortiesAll > 0 ? (bucketMap[bucket]!.amount / totalSortiesAll) * 100 : 0,
    color: BUCKET_COLORS[bucket],
    categories: bucketMap[bucket]!.categories.sort((a, b) => b.amount - a.amount),
  }));
}

/**
 * Un budget est pris en compte s'il est actif ET dans le périmètre de calcul.
 * Un périmètre vide signifie « tous les budgets ».
 */
export function isBudgetInCalculationScope(
  budget: ScopedBudgetLike,
  calculationScope: string[],
): boolean {
  const isActive = budget.actif !== false;
  const inScope =
    calculationScope.length === 0 ||
    calculationScope.includes(budget.id) ||
    calculationScope.includes(budget.categorie || '');
  return isActive && inScope;
}

/**
 * Somme des budgets de revenus dans le périmètre (revenu explicite, type « revenu »,
 * ou catégorie détectée comme majoritairement créditrice).
 */
export function computeIncomeBudget(
  budgets: ScopedBudgetLike[],
  calculationScope: string[],
  incomeCategories: Set<string>,
): number {
  return budgets.reduce((sum, b) => {
    if (!isBudgetInCalculationScope(b, calculationScope)) return sum;
    const isIncome =
      b.isIncome === true || b.type === 'revenu' || incomeCategories.has(b.categorie || b.id);
    return isIncome ? sum + (b.montant || 0) : sum;
  }, 0);
}

/** Total dépensé (montants négatifs) sur les catégories budgétées du périmètre. */
export function computeSpentInBudget(
  transactions: Transaction[],
  budgets: ScopedBudgetLike[],
  calculationScope: string[],
): number {
  const budgetedCats = new Set(
    budgets.filter((b) => isBudgetInCalculationScope(b, calculationScope)).map((b) => b.categorie),
  );
  return transactions
    .filter((tx) => (tx.montant || 0) < 0 && budgetedCats.has(tx.categorie || ''))
    .reduce((sum, tx) => sum + Math.abs(tx.montant || 0), 0);
}

export interface CategoryGroupsResult {
  groups: Record<string, CategoryGroup>;
  visibleTotal: number;
  rawTransactions: Transaction[];
  totalEntrees: number;
  totalSorties: number;
}

/**
 * Ventile les transactions du mois filtré en groupes de catégories selon l'onglet actif
 * et calcule les totaux entrées/sorties (hors catégories masquées) ainsi que le total visible.
 *
 * - onglet `entrees` / `sorties` : agrège les transactions du signe correspondant ;
 * - autres onglets : agrège toutes les transactions filtrées.
 */
export function computeCategoryGroups(
  filteredTransactions: Transaction[],
  activeTab: AnalyseTab,
  hiddenCategories: Set<string>,
): CategoryGroupsResult {
  const entreeTx = filteredTransactions.filter((tx) => (tx.montant || 0) > 0);
  const sortieTx = filteredTransactions.filter((tx) => (tx.montant || 0) < 0);
  const isVisible = (tx: { categorie?: string }) =>
    !hiddenCategories.has(tx.categorie || 'Non catégorisé');
  const totalEntrees = entreeTx.filter(isVisible).reduce((s, tx) => s + (tx.montant || 0), 0);
  const totalSorties = sortieTx
    .filter(isVisible)
    .reduce((s, tx) => s + Math.abs(tx.montant || 0), 0);

  let rawTransactions = filteredTransactions;
  if (activeTab === 'entrees') {
    rawTransactions = entreeTx;
  } else if (activeTab === 'sorties') {
    rawTransactions = sortieTx;
  }

  const groups: Record<string, CategoryGroup> = {};
  rawTransactions.forEach((tx) => {
    const cat = tx.categorie || 'Non catégorisé';
    if (!groups[cat]) groups[cat] = { amount: 0, count: 0 };
    groups[cat]!.amount += Math.abs(tx.montant || 0);
    groups[cat]!.count += 1;
  });

  const visibleTotal = Object.entries(groups)
    .filter(([name]) => !hiddenCategories.has(name))
    .reduce((acc, [, g]) => acc + g.amount, 0);

  return { groups, visibleTotal, rawTransactions, totalEntrees, totalSorties };
}
