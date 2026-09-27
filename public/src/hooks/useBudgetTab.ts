import { useCallback, useState } from 'react';

export type BudgetTab = 'budgets' | 'enveloppes';

const STORAGE_KEY = 'budget_tab';

const readTab = (): BudgetTab => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'enveloppes' ? 'enveloppes' : 'budgets';
  } catch {
    return 'budgets';
  }
};

/** Onglet actif de l'écran Budgets (« Budgets » / « Enveloppes »), mémorisé par appareil. */
export const useBudgetTab = () => {
  const [tab, setTabState] = useState<BudgetTab>(readTab);

  const setTab = useCallback((next: BudgetTab) => {
    setTabState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée) : l'onglet reste valable pour la session.
    }
  }, []);

  return { tab, setTab };
};
