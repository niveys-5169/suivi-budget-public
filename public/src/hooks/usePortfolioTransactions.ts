// src/hooks/usePortfolioTransactions.ts
import { useState, useEffect, useCallback } from 'react';
import { getTransactions } from '../services/portfolioService';
import { usePortfolioAuth } from './usePortfolioAuth';
import type { PortfolioTx } from '../utils/portfolioReconstruction';

/**
 * Hook that fetches and returns the user's portfolio transactions.
 * @returns {Object} transactions array, loading state, error, and a refresh function.
 * The refresh function returns a Promise that resolves to the transactions array (or null).
 */
export const usePortfolioTransactions = () => {
  const { user } = usePortfolioAuth();
  const [transactions, setTransactions] = useState<PortfolioTx[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (): Promise<PortfolioTx[] | null> => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions(user.uid);
      setTransactions(data);
      return data;
    } catch (err) {
      console.error('[usePortfolioTransactions] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Fetch on mount
    // Chargement réseau (système externe), fetchTransactions sert aussi au refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions();
  }, [fetchTransactions]);

  const refresh = useCallback(() => {
    return fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refresh };
};
