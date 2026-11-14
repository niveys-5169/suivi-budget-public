import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { DEFAULT_BUDGET_EXCLUDED_CATEGORIES } from '../constants/budgetExclusions';
import { auditedMerge } from '../services/auditLog';

const EXCLUSIONS_DOC = doc(db, 'metadata', 'budget_excluded_categories');

/**
 * Liste configurable des catégories exclues des budgets.
 * Lue en temps réel depuis Firestore (`metadata/budget_excluded_categories`).
 * Tant que le document n'existe pas, on retombe sur la liste par défaut afin de
 * préserver le comportement actuel.
 */
export const useBudgetExclusions = () => {
  const [excluded, setExcludedState] = useState<string[]>(DEFAULT_BUDGET_EXCLUDED_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(EXCLUSIONS_DOC, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExcludedState(Array.isArray(data.categories) ? data.categories : []);
      } else {
        setExcludedState(DEFAULT_BUDGET_EXCLUDED_CATEGORIES);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const setExcluded = useCallback(async (next: string[]) => {
    await auditedMerge(
      'budget',
      EXCLUSIONS_DOC,
      { categories: next, updatedAt: serverTimestamp() },
      'Catégories exclues du budget',
    );
  }, []);

  return { excluded, setExcluded, loading };
};
