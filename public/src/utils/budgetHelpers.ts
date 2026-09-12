import { BudgetBase, Transaction, Recurrence } from '../types/banking.types';
import { budgetDocKey } from './budgetKey';
import { getCatStyle, normalizeSearchValue } from './categoryUtils';

/**
 * Utilitaires pour le dashboard budgétaire
 * Identification des catégories spéciales, tri, couleurs
 */

/**
 * Clé de comparaison canonique d'une catégorie.
 * Collapse casse, accents, espaces de bord et encodage NFC/NFD afin que deux
 * libellés visuellement identiques (ex. "Santé" / "santé" / "Santé ") matchent.
 */
export const categoryKey = (name: string | null | undefined): string =>
  normalizeSearchValue((name ?? '').trim());

/**
 * Choisit le meilleur libellé d'affichage parmi des graphies variantes d'une même
 * catégorie. Préfère le plus d'accents (plus "complet"), puis le plus de majuscules
 * (casse propre, ex. "Santé" plutôt que "santé"), puis le plus long une fois trimmé.
 */
export const preferDisplayLabel = (a: string, b: string): string => {
  const ta = (a ?? '').trim();
  const tb = (b ?? '').trim();
  if (!ta) return tb;
  if (!tb) return ta;
  const accents = (s: string) => [...s].filter((c) => c.normalize('NFD').length > c.length).length;
  if (accents(ta) !== accents(tb)) return accents(ta) > accents(tb) ? ta : tb;
  const upper = (s: string) => [...s].filter((c) => c !== c.toLowerCase()).length;
  if (upper(ta) !== upper(tb)) return upper(ta) > upper(tb) ? ta : tb;
  return ta.length >= tb.length ? ta : tb;
};

/**
 * Déduplique des enveloppes par catégorie NORMALISÉE (casse/accents/espaces/NFC-NFD),
 * pour neutraliser les graphies variantes et les ID legacy (auto-ID Firestore).
 * Sur collision, conserve le meilleur enregistrement (financé `montant>0` d'abord,
 * puis ID déterministe `budgetDocKey`) et garde le libellé d'affichage canonique.
 */
export const dedupeBudgetsByCategory = (data: BudgetBase[]): BudgetBase[] => {
  const score = (x: BudgetBase) => {
    const xCat = x.categorie || x.id;
    return ((x.montant ?? 0) > 0 ? 2 : 0) + (x.id === budgetDocKey(xCat) ? 1 : 0);
  };

  const unique = new Map<string, BudgetBase>();
  data.forEach((b) => {
    const rawCat = b.categorie || b.id;
    const key = categoryKey(rawCat);
    const current = unique.get(key);
    const chosen = current && score(current) > score(b) ? current : b;
    const label = preferDisplayLabel(current?.categorie || rawCat, rawCat);

    unique.set(key, {
      ...chosen,
      actif: chosen.actif !== undefined ? chosen.actif : true,
      nom: chosen.nom || label,
      categorie: label,
    });
  });
  return Array.from(unique.values());
};

/**
 * Identifie si une catégorie est non-récurrente avec budget fixe
 * Patterns: Crédit, Assurance, Vacances, Kdo, Prime, Noel, etc.
 */
export const isSpecialBudgetCategory = (categoryName: string): boolean => {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();

  const patterns = [
    'crédit',
    'assurance',
    'vacances',
    'kdo',
    'prime',
    'noel',
    'extension',
    'travaux',
    'renouvellement',
  ];

  return patterns.some((pattern) => lower.includes(pattern));
};

/**
 * Construit l'ensemble des catégories couvertes par des récurrences actives.
 * Sert à distinguer les enveloppes "charges fixes" (prévisibles) des enveloppes
 * variables que l'utilisateur doit réellement surveiller.
 */
export const buildRecurringCategorySet = (recurrences: Recurrence[]): Set<string> => {
  const set = new Set<string>();
  (recurrences || []).forEach((r) => {
    if (!r.active) return;
    const cat = (r.category || '').trim().toLowerCase();
    if (cat) set.add(cat);
  });
  return set;
};

/**
 * Une enveloppe est considérée "récurrente / charge fixe" si sa catégorie est
 * couverte par un abonnement accepté, ou si elle correspond aux motifs spéciaux
 * (crédit, assurance, loyer ponctuel, etc.).
 */
export const isRecurringBackedCategory = (
  categoryName: string,
  recurringCategories: Set<string>,
): boolean => {
  const cat = (categoryName || '').trim().toLowerCase();
  if (cat && recurringCategories.has(cat)) return true;
  return isSpecialBudgetCategory(categoryName);
};

/**
 * Retourne un emoji/icône pour une catégorie
 */
export const getCategoryIcon = (categoryName: string): string => {
  const style = getCatStyle(categoryName);
  return style.icon;
};

/**
 * Couleur dynamique basée sur le seuil 90%
 */
export const getStatusColor = (spent: number, budget: number): string => {
  if (budget === 0) return '#6b7280'; // gris si pas de budget

  const percentage = (spent / budget) * 100;

  if (percentage > 100) return '#dc2626'; // rouge foncé - dépassement
  if (percentage >= 90) return '#ef4444'; // rouge - alerte
  if (percentage >= 75) return '#f59e0b'; // orange - attention
  return '#10b981'; // vert - ok
};

/**
 * Trie et sépare les catégories en:
 * - Top 10 par montant dépensé
 * - Catégories spéciales (jusqu'à 8)
 */
export interface BudgetCategory {
  id: string;
  budget: number;
  spent: number;
  percentage: number;
  icon: string;
  color: string;
  statusColor: string;
  isSpecial: boolean;
}

export const getCategoriesForDashboard = (
  budgets: Array<BudgetBase & { spent?: number; budget?: number }>,
  expenseByCategory: { [key: string]: number },
  topCount: number = 4,
): { topCategories: BudgetCategory[]; special: BudgetCategory[]; all: BudgetCategory[] } => {
  // Créer liste complète avec montants
  const allCategories: BudgetCategory[] = budgets.map((b) => {
    // Préfère b.spent si déjà calculé (ex: net réel dans le dashboard), sinon expenseByCategory
    const spent = typeof b.spent === 'number' ? b.spent : expenseByCategory[b.id] || 0;
    const budget = b.budget || b.montant || 0;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;
    const isSpecial = isSpecialBudgetCategory(b.id);
    const style = getCatStyle(b.id);

    return {
      id: b.id,
      budget,
      spent,
      percentage,
      icon: style.icon,
      color: style.color,
      statusColor: getStatusColor(spent, budget),
      isSpecial,
    };
  });

  // Séparer spéciales vs normales
  const specialCategories = allCategories.filter((c) => c.isSpecial);
  const regularCategories = allCategories.filter((c) => !c.isSpecial);

  // Trier par montant dépensé (décroissant)
  regularCategories.sort((a, b) => b.spent - a.spent);
  specialCategories.sort((a, b) => b.spent - a.spent);

  // Top régulières
  const topCategories = regularCategories.slice(0, topCount);

  // Max 8 spéciales
  const special = specialCategories.slice(0, 8);

  return { topCategories, special, all: allCategories };
};

/**
 * Calcule les stats globales pour KPIs
 */
export interface BudgetStats {
  totalBudget: number;
  totalSpent: number;
  totalDiff: number;
  percentageUsed: number;
  categoriesOnAlert: number;
}

export const calculateBudgetStats = (
  budgets: Array<Partial<BudgetBase> & { budget?: number }>,
  expenseByCategory: { [key: string]: number },
): BudgetStats => {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const expenseBudgets = budgets.filter((b) => !isIncomeBudget(b));
  const totalBudget = round2(
    expenseBudgets.reduce((sum: number, b) => sum + (Number(b?.budget || b?.montant) || 0), 0),
  );
  const totalSpent = round2(
    Object.values(expenseByCategory).reduce((sum: number, val) => sum + (Number(val) || 0), 0),
  );
  const totalDiff = round2(totalSpent - totalBudget);
  const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const categoriesOnAlert = expenseBudgets.filter((b) => {
    const id = b.id;
    if (!id) return false;
    const spent = Number(expenseByCategory[id]) || 0;
    const threshold = (Number(b?.budget || b?.montant) || 0) * 0.9;
    return spent >= threshold;
  }).length;

  return {
    totalBudget,
    totalSpent,
    totalDiff,
    percentageUsed,
    categoriesOnAlert,
  };
};

/**
 * Formate pourcentage avec 1 décimale
 */
export const formatPercentage = (value: number): string => {
  return `${Math.min(Math.round(value * 10) / 10, 100)}%`;
};

/**
 * Identifie si un budget est un budget de revenus.
 * Retourne true si b.isIncome === true ou b.type === 'revenu'.
 */
export const isIncomeBudget = (b: Partial<BudgetBase>): boolean => {
  if (b?.isIncome === true) return true;
  if (b?.isIncome === false) return false; // Sortie forcée : override les heuristiques
  return b?.type === 'revenu';
};

export const isRefundPositive = (isIncome: boolean, spent: number): boolean =>
  !isIncome && spent < 0;

/**
 * Somme des revenus budgétés ramenée au mensuel.
 *
 * Identifie un budget revenu via `b.isIncome === true`, `b.type === 'revenu'`,
 * ou l'auto-détection sur l'historique de transactions (catégorie majoritairement créditrice).
 * BudgetContext fournit déjà `montant` scalé selon viewMode :
 *   - 'monthly' → montant déjà mensuel
 *   - 'annual'  → montant annuel, divisé par 12 ici
 */
export const getBudgetedMonthlyIncome = (
  budgets: BudgetBase[],
  viewMode: 'monthly' | 'annual' = 'monthly',
  transactions: Transaction[] = [],
): number => {
  if (!Array.isArray(budgets)) return 0;
  const incomeCatSet = new Set<string>();

  // Auto-detect based on historical transactions
  const catStats: Record<string, { pos: number; neg: number }> = {};
  const allTxs = Array.isArray(transactions) ? transactions : [];
  allTxs.forEach((t) => {
    const c = t.categorie;
    if (!c) return;
    if (!catStats[c]) catStats[c] = { pos: 0, neg: 0 };
    if (Number(t.montant) > 0) catStats[c].pos++;
    else if (Number(t.montant) < 0) catStats[c].neg++;
  });
  Object.entries(catStats).forEach(([c, stats]) => {
    const total = stats.pos + stats.neg;
    if (total >= 5 && stats.pos / total >= 0.75) {
      incomeCatSet.add(c);
    }
  });

  return budgets
    .filter(
      (b) =>
        b?.actif !== false &&
        b?.isIncome !== false &&
        (b?.isIncome === true || b?.type === 'revenu' || incomeCatSet.has(b?.categorie || b?.id)),
    )
    .reduce((sum: number, b) => {
      const amount = Number(b.montant) || 0;
      const monthly = viewMode === 'annual' ? amount / 12 : amount;
      return sum + monthly;
    }, 0);
};
