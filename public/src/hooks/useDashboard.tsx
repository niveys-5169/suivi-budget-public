import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTransactions } from './useTransactions';
import { useBudget } from './useBudget';
import { usePreferences } from './usePreferences';

import { useAppState } from '../context/AppStateContext';

export type DashboardPeriod =
  'current_month' | 'year_to_date' | 'last_year' | 'custom' | 'all_time';

export interface RavConfig {
  revenu_mensuel_net: number | null;
  revenu_categories: string[] | null;
  depense_categories: string[] | null;
  provision_salaires?: Record<string, { montant: number; categorie: string }>;
}

import { useGlobalData } from '../context/GlobalDataContext';
import { useDashboardFiltered } from './useDashboardFiltered';
import { useDashboardStats } from './useDashboardStats';

/** Agrège les données du dashboard : solde global, RAV, transactions récentes et alertes. */
export const useDashboard = () => {
  const { ravConfig: globalRavConfig } = useGlobalData();
  const {
    transactions,
    loading,
    error,
    togglePointe,
    saveTransaction,
    deleteTransaction,
    requestFullLoad,
  } = useTransactions();
  const { getBudgetCategoryCandidates } = useBudget();
  const { monthKey, setMonthKey } = useAppState();

  const [period, setPeriod] = useState<DashboardPeriod>('current_month');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const ravConfig = useMemo(
    () => ({
      revenu_mensuel_net: globalRavConfig?.revenu_mensuel_net ?? null,
      revenu_categories: globalRavConfig?.revenu_categories ?? null,
      depense_categories: globalRavConfig?.depense_categories ?? null,
    }),
    [globalRavConfig],
  );

  const { dashboardCategories, setDashboardCategories } = usePreferences();

  // La liste triée des catégories ne change quasiment jamais, alors que
  // `transactions` se met à jour à chaque snapshot Firestore. On dérive d'abord
  // une signature stable, puis on ne reconstruit le tableau (nouvelle référence)
  // que lorsque cette signature change — évitant un re-render en cascade des
  // consommateurs qui ne lisent que `allCategories` (ex: AurumDashboard).
  const allCategoriesSignature = useMemo(() => {
    const candidates = getBudgetCategoryCandidates();
    const fromCurrentTxs = transactions.map((t) => (t.categorie || 'Non catégorisé').trim());

    return Array.from(new Set([...candidates, ...fromCurrentTxs]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .join('\u0001');
  }, [getBudgetCategoryCandidates, transactions]);

  const allCategories = useMemo(
    () => (allCategoriesSignature ? allCategoriesSignature.split('\u0001') : []),
    [allCategoriesSignature],
  );

  // Initialize with all categories if empty.
  // Use a ref to prevent multiple syncs during the same session if it fails.
  const hasAttemptedInit = useRef(false);
  const { loading: prefsLoading } = usePreferences();

  useEffect(() => {
    if (prefsLoading || hasAttemptedInit.current) return;

    if (dashboardCategories.length === 0 && allCategories.length > 0) {
      hasAttemptedInit.current = true;
      setDashboardCategories(allCategories);
    }
  }, [allCategories, dashboardCategories.length, setDashboardCategories, prefsLoading]);

  const selectedCategoriesMemo = useMemo(() => new Set(dashboardCategories), [dashboardCategories]);

  const dashboardFilteredTransactions = useDashboardFiltered(
    transactions,
    period,
    monthKey,
    customRange,
    selectedCategoriesMemo,
  );

  const stats = useDashboardStats(dashboardFilteredTransactions);

  const shiftMonth = useCallback(
    (delta: number) => {
      const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
      const d = new Date(year, month - 1 + delta, 1);
      setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      setPeriod('current_month');
    },
    [monthKey, setMonthKey],
  );

  return {
    period,
    setPeriod,
    monthKey,
    setMonthKey,
    customRange,
    setCustomRange,
    selectedCategories: selectedCategoriesMemo,
    setSelectedCategories: (cats: Set<string>) => setDashboardCategories(Array.from(cats)),
    allCategories,
    filteredTransactions: dashboardFilteredTransactions,
    transactions,
    stats,
    ravConfig,
    togglePointe,
    saveTransaction,
    deleteTransaction,
    requestFullLoad,
    shiftMonth,
    loading,
    error,
  };
};
