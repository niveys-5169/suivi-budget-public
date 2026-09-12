import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type BudgetPeriodMode = 'month' | 'year';

export interface TransactionFilters {
  accountIds: string[];
  reconcileStatus: 'all' | 'reconciled' | 'unreconciled';
  dateRange: {
    start: string;
    end: string;
  };
}

interface AppStateContextType {
  budgetCategoryScope: string[];
  setBudgetCategoryScope: (categories: string[]) => void;
  budgetCalculationScope: string[];
  setBudgetCalculationScope: (categories: string[]) => void;
  transactionFilters: TransactionFilters;
  setTransactionFilters: (filters: TransactionFilters) => void;
  budgetPeriodMode: BudgetPeriodMode;
  setBudgetPeriodMode: (mode: BudgetPeriodMode) => void;
  monthKey: string;
  setMonthKey: (key: string) => void;
  isBudgetScopeVisible: boolean;
  setIsBudgetScopeVisible: (visible: boolean) => void;
}

export const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

const STORAGE_KEYS = {
  BUDGET_CATEGORY_SCOPE: 'app_budget_category_scope',
  BUDGET_CALCULATION_SCOPE: 'app_budget_calculation_scope',
  BUDGET_PERIOD_MODE: 'app_budget_period_mode',
  MONTH_KEY: 'app_month_key',
  TRANSACTION_FILTERS: 'app_transaction_filters',
  IS_BUDGET_SCOPE_VISIBLE: 'app_is_budget_scope_visible',
};

/** Fournit l'état UI partagé (filtres budget, mode période) à toute l'app. */
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [budgetCategoryScope, setBudgetCategoryScope] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGET_CATEGORY_SCOPE);
    return saved ? JSON.parse(saved) : [];
  });
  const [budgetCalculationScope, setBudgetCalculationScope] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGET_CALCULATION_SCOPE);
    return saved ? JSON.parse(saved) : [];
  });
  const [budgetPeriodMode, setBudgetPeriodMode] = useState<BudgetPeriodMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGET_PERIOD_MODE) as BudgetPeriodMode;
    return saved || 'month';
  });
  const [monthKey, setMonthKey] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MONTH_KEY);
    if (saved) return saved;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isBudgetScopeVisible, setIsBudgetScopeVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.IS_BUDGET_SCOPE_VISIBLE);
    return saved ? JSON.parse(saved) : false;
  });
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTION_FILTERS);
    return saved
      ? JSON.parse(saved)
      : {
          accountIds: [],
          reconcileStatus: 'all',
          dateRange: { start: '', end: '' },
        };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDGET_CATEGORY_SCOPE, JSON.stringify(budgetCategoryScope));
  }, [budgetCategoryScope]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.BUDGET_CALCULATION_SCOPE,
      JSON.stringify(budgetCalculationScope),
    );
  }, [budgetCalculationScope]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDGET_PERIOD_MODE, budgetPeriodMode);
  }, [budgetPeriodMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MONTH_KEY, monthKey);
  }, [monthKey]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.IS_BUDGET_SCOPE_VISIBLE,
      JSON.stringify(isBudgetScopeVisible),
    );
  }, [isBudgetScopeVisible]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTION_FILTERS, JSON.stringify(transactionFilters));
  }, [transactionFilters]);

  return (
    <AppStateContext.Provider
      value={{
        budgetCategoryScope,
        setBudgetCategoryScope,
        budgetCalculationScope,
        setBudgetCalculationScope,
        transactionFilters,
        setTransactionFilters,
        budgetPeriodMode,
        setBudgetPeriodMode,
        monthKey,
        setMonthKey,
        isBudgetScopeVisible,
        setIsBudgetScopeVisible,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

/** Consomme AppStateContext — expose et met à jour l'état UI global. */
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
