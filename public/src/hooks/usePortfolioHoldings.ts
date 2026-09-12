// src/hooks/usePortfolioHoldings.ts
import { useState, useEffect, useCallback } from 'react';
import { getHoldings, type Holding } from '../services/portfolioService';
import { usePortfolioAuth } from './usePortfolioAuth';

/**
 * Hook that fetches and returns the user's portfolio holdings.
 * @returns {Object} holdings array, loading state, error, and a refresh function.
 */
export const usePortfolioHoldings = () => {
  const { user } = usePortfolioAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHoldings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getHoldings(user.uid);
      setHoldings(data);
    } catch (err) {
      console.error('[usePortfolioHoldings] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const refresh = useCallback(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  return { holdings, loading, error, refresh };
};
