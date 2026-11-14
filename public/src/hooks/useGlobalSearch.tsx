import { useMemo } from 'react';
import { useTransactionContext } from '../context/TransactionContext';
import { searchGlobal, type SearchResult } from '../utils/searchGlobal';
import { useDebounce } from './useDebounce';

export const NAVIGABLE_PAGES = [
  { label: 'Tableau de bord', tab: '/' },
  { label: 'Transactions', tab: '/transactions' },
  { label: 'Analyse', tab: '/analyse' },
  { label: 'Budgets', tab: '/budgets' },
  { label: 'Récurrences', tab: '/recurring' },
  { label: 'Patrimoine', tab: '/patrimoine' },
  { label: 'Projections', tab: '/projections' },
  { label: 'Assistant', tab: '/qa' },
  { label: 'Ma semaine', tab: '/semaine' },
  { label: 'Journal', tab: '/journal' },
  { label: 'Notifications', tab: '/notifications' },
  { label: 'Connexions bancaires', tab: '/connexions' },
  { label: 'Paramètres', tab: '/settings' },
  { label: 'Règles', tab: '/rules' },
  { label: 'Correspondances', tab: '/mappings' },
  { label: 'Fusion', tab: '/fusion' },
  { label: 'Réanalyse', tab: '/reparse' },
  { label: 'Emails exclus', tab: '/excluded' },
  { label: 'Tronity', tab: '/tronity' },
];

/** Recherche globale : retourne les pages et transactions correspondant à la query. */
export const useGlobalSearch = (query: string): SearchResult[] => {
  const { transactions } = useTransactionContext();
  const debouncedQuery = useDebounce(query, 150);

  return useMemo(
    () => searchGlobal(debouncedQuery, transactions, NAVIGABLE_PAGES),
    [debouncedQuery, transactions],
  );
};
