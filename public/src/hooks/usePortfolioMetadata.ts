// src/hooks/usePortfolioMetadata.ts
import { useState, useCallback } from 'react';
import { updateMetadata } from '../services/portfolioService';

/**
 * Hook that provides a function to update portfolio metadata in Firestore.
 * @returns {Object} updateMetadata function, loading state, error.
 */
export const usePortfolioMetadata = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const updatePortfolioMetadata = useCallback(async (uid: string, totalValue: number) => {
    setLoading(true);
    setError(null);
    try {
      await updateMetadata(uid, totalValue);
    } catch (err) {
      console.error('[usePortfolioMetadata] Update failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { updatePortfolioMetadata, loading, error };
};
