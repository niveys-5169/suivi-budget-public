// src/hooks/usePortfolioBackfill.ts
import { useState, useCallback } from 'react';
import { backfillPortfolioHistory } from '../services/portfolioService';
import { usePortfolioAuth } from './usePortfolioAuth';

/**
 * Hook that provides a function to backfill portfolio history from transactions.
 * @returns {Object} backfill function, loading state, error, and result.
 */
export const usePortfolioBackfill = () => {
  const { user } = usePortfolioAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ written: number; skipped: number } | null>(null);

  const backfillHistory = useCallback(async () => {
    if (!user) {
      setError('Utilisateur non authentifié');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await backfillPortfolioHistory(user.uid);
      setResult(res);
    } catch (err) {
      console.error('[usePortfolioBackfill] Backfill failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { backfillHistory, loading, error, result };
};
