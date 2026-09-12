import { useMemo } from 'react';
import { useBudget } from './useBudget';
import { useTransactions } from './useTransactions';
import { useBalances } from './useBalances';
import { CASH_ACCOUNT_NAME, type Transaction } from '../types/banking.types';

interface BalanceLike {
  compte?: string | null;
}

/**
 * Catégories proposées dans un formulaire : candidats budget + catégories déjà
 * vues dans les transactions, dédoublonnées et triées.
 *
 * NB : tri lexicographique simple (`.sort()`), aligné sur les écrans mobile
 * (`HomeScreen`, `TransactionsScreen`). Les écrans desktop (`AnalyseSection`…)
 * utilisent volontairement une variante `localeCompare('fr')` avec `.trim()` —
 * non unifiée ici pour ne pas changer leur ordre d'affichage.
 */
export function deriveCategoryOptions(candidates: string[], transactions: Transaction[]): string[] {
  const fromTxs = new Set(
    transactions.map((t) => t.categorie).filter((c): c is string => Boolean(c)),
  );
  return Array.from(new Set([...candidates, ...fromTxs])).sort();
}

/**
 * Comptes distincts présents dans les soldes, triés, avec le compte virtuel
 * "Liquide" toujours proposé pour comptabiliser les dépenses/recettes en
 * espèces (non relié à un compte bancaire réel).
 */
export function deriveAccountOptions(balances: BalanceLike[]): string[] {
  return Array.from(new Set([...balances.map((b) => b.compte), CASH_ACCOUNT_NAME]))
    .filter((c): c is string => Boolean(c))
    .sort();
}

/**
 * Options de formulaire partagées (catégories + comptes) pour les écrans mobile
 * qui alimentent `TransactionFormModal` / filtres. Absorbe le calcul recopié à
 * l'identique dans `HomeScreen` et `TransactionsScreen`.
 */
export function useFormOptions(): { categories: string[]; accounts: string[] } {
  const { getBudgetCategoryCandidates } = useBudget();
  const { filteredTransactions } = useTransactions();
  const { balances } = useBalances();

  const categories = useMemo(
    () => deriveCategoryOptions(getBudgetCategoryCandidates(), filteredTransactions),
    [getBudgetCategoryCandidates, filteredTransactions],
  );

  const accounts = useMemo(() => deriveAccountOptions(balances), [balances]);

  return { categories, accounts };
}
