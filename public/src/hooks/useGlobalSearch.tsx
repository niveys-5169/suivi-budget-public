import { useMemo } from 'react';
import { useTransactionContext } from '../context/TransactionContext';
import { searchGlobal, type SearchResult } from '../utils/searchGlobal';
import { useDebounce } from './useDebounce';

export const NAVIGABLE_PAGES = [
  { label: 'Budget', tab: 'budget' },
  { label: 'Patrimoine', tab: 'wealth' },
  { label: 'Récurrences', tab: 'recurring' },
  { label: 'Automatisations', tab: 'rules' },
  { label: 'Transactions', tab: 'flux' },
  { label: 'Analyses', tab: 'insights' },
  { label: 'Intelligence IA', tab: 'ai' },
  { label: 'Notifications', tab: 'notifications' },
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
