import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { state as globalStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useAppState } from './AppStateContext';
import { withRetry } from '../utils/withRetry';
import { useFirestoreErrorHandler } from '../hooks/useFirestoreErrorHandler';
import { BudgetBase } from '../types/banking.types';
import { budgetDocKey } from '../utils/budgetKey';
import { dedupeBudgetsByCategory } from '../utils/budgetHelpers';
import { resolveEffectiveBudgets } from '../utils/budgetResolution';
import { FALLBACK_CATEGORIES } from '../constants/categories';

interface MonthlyBudget extends BudgetBase {
  month: string;
  mois: string;
  budget: number;
}

interface AnnualBudget extends BudgetBase {
  year: string;
  annualMontant: number;
  budget: number;
}

interface BudgetContextType {
  viewMode: 'monthly' | 'annual';
  setViewMode: (mode: 'monthly' | 'annual') => void;
  monthKey: string;
  setMonthKey: (key: string) => void;
  budgets: BudgetBase[];
  loading: boolean;
  refresh: () => void;
  getBudgetCategoryCandidates: () => string[];
  updateMonthlyBudget: (categorie: string, montant: number) => Promise<void>;
  updateAnnualDefault: (categorie: string, annualMontant: number) => Promise<void>;
  updateBaseBudget: (
    categorie: string,
    montant: number,
    type?: 'mensuel' | 'annuel' | 'ponctuel' | 'revenu',
    isIncome?: boolean,
  ) => Promise<void>;
  removeBudgetCategory: (categorie: string) => Promise<void>;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

/** Fournit l'ensemble de l'état budget (enveloppes, overrides, helpers) à l'arbre React. */
export const BudgetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { budgetPeriodMode, setBudgetPeriodMode, monthKey, setMonthKey } = useAppState();
  const { handle: handleFsError } = useFirestoreErrorHandler();

  const viewMode = budgetPeriodMode === 'year' ? 'annual' : 'monthly';
  const setViewMode = useCallback(
    (mode: 'monthly' | 'annual') => {
      setBudgetPeriodMode(mode === 'annual' ? 'year' : 'month');
    },
    [setBudgetPeriodMode],
  );

  const [budgets, setBudgets] = useState<BudgetBase[]>([]);
  const [monthly, setMonthly] = useState<MonthlyBudget[]>([]);
  const [annual, setAnnual] = useState<AnnualBudget[]>([]);
  const [loading, setLoading] = useState(true);

  const computedBudgets = useMemo(
    () => resolveEffectiveBudgets(budgets, monthly, annual, monthKey, viewMode),
    [budgets, monthly, annual, monthKey, viewMode],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setBudgets([]);
      setMonthly([]);
      setAnnual([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'budgets')),
        (snap) => {
          let data: BudgetBase[] = snap.docs.map((doc) => {
            const d = doc.data() as BudgetBase;
            return { ...d, id: doc.id };
          });
          if (data.length === 0) {
            const defaults =
              (globalStore as { BUDGET_DEFAULTS?: Record<string, number> }).BUDGET_DEFAULTS || {};
            data = Object.entries(defaults).map(([cat, montant]) => ({
              id: cat,
              categorie: cat,
              nom: cat,
              montant: Number(montant) || 0,
              actif: true,
              type: 'mensuel',
            }));
          }

          // De-duplicate by NORMALIZED category name (collapses case/accents/
          // whitespace/NFC-NFD) to handle legacy ID discrepancies and graphie variants.
          setBudgets(dedupeBudgetsByCategory(data));
          setLoading(false);
        },
        (err) => {
          console.error('[BudgetContext] Error loading budgets:', err);
          const defaults =
            (globalStore as { BUDGET_DEFAULTS?: Record<string, number> }).BUDGET_DEFAULTS || {};
          setBudgets(
            Object.entries(defaults).map(([cat, montant]) => ({
              id: cat,
              categorie: cat,
              nom: cat,
              montant: Number(montant) || 0,
              actif: true,
              type: 'mensuel',
            })),
          );
          setLoading(false);
        },
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'budgets_monthly')),
        (snap) => {
          setMonthly(
            snap.docs.map(
              (d) =>
                ({
                  id: d.id,
                  ...(d.data() as Record<string, unknown>),
                  mois: (d.data() as { month?: string }).month || '',
                  budget: Number((d.data() as { montant?: number }).montant) || 0,
                }) as MonthlyBudget,
            ),
          );
        },
        () => setMonthly([]),
      ),
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'budgets_annual_defaults')),
        (snap) => {
          setAnnual(
            snap.docs.map(
              (d) =>
                ({
                  id: d.id,
                  ...(d.data() as Record<string, unknown>),
                  budget: Number((d.data() as { annualMontant?: number }).annualMontant) || 0,
                }) as AnnualBudget,
            ),
          );
        },
        () => setAnnual([]),
      ),
    );

    return () => unsubs.forEach((u) => u());
  }, [user, authLoading]);

  const refresh = useCallback(() => {
    // onSnapshot is real-time, no need for manual refresh which would leak listeners.
  }, []);

  const getBudgetCategoryCandidates = useCallback(() => {
    const fromBudgets = new Set(budgets.map((b) => b.categorie));
    const fromPreset = Object.values(FALLBACK_CATEGORIES).flat();
    return Array.from(new Set([...fromPreset, ...fromBudgets]))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'fr'));
  }, [budgets]);

  const updateMonthlyBudget = useCallback(
    async (categorie: string, montant: number) => {
      const docId = `${monthKey}__${budgetDocKey(categorie)}`;
      try {
        await withRetry(() =>
          setDoc(
            doc(db, 'budgets_monthly', docId),
            {
              month: monthKey,
              categorie,
              montant,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        );
      } catch (err) {
        handleFsError(err, {
          context: 'budget.updateMonthly',
          extras: { categorie, montant },
          fallbackKey: 'error.fs.fallback.budget.updateMonthly',
        });
        throw err;
      }
    },
    [monthKey, handleFsError],
  );

  const updateAnnualDefault = useCallback(
    async (categorie: string, annualMontant: number) => {
      const year = monthKey.split('-')[0];
      const docId = `${year}__${budgetDocKey(categorie)}`;
      try {
        await withRetry(() =>
          setDoc(
            doc(db, 'budgets_annual_defaults', docId),
            {
              year,
              categorie,
              annualMontant,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        );
      } catch (err) {
        handleFsError(err, {
          context: 'budget.updateAnnual',
          extras: { categorie, annualMontant },
          fallbackKey: 'error.fs.fallback.budget.updateAnnual',
        });
        throw err;
      }
    },
    [monthKey, handleFsError],
  );

  const updateBaseBudget = useCallback(
    async (
      categorie: string,
      montant: number,
      type: 'mensuel' | 'annuel' | 'ponctuel' | 'revenu' = 'mensuel',
      isIncome?: boolean,
    ) => {
      const docId = budgetDocKey(categorie);
      try {
        await withRetry(() =>
          setDoc(
            doc(db, 'budgets', docId),
            {
              categorie,
              nom: categorie,
              montant,
              type,
              actif: true,
              isIncome: isIncome !== undefined ? isIncome : type === 'revenu',
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          ),
        );
      } catch (err) {
        handleFsError(err, {
          context: 'budget.updateBase',
          extras: { categorie, montant },
          fallbackKey: 'error.fs.fallback.budget.updateBase',
        });
        throw err;
      }
    },
    [handleFsError],
  );

  const removeBudgetCategory = useCallback(
    async (categorie: string) => {
      const matching = budgets.filter((b) => (b.categorie || b.id) === categorie);
      const ids = matching.length > 0 ? matching.map((b) => b.id) : [budgetDocKey(categorie)];
      await Promise.all(
        ids.map(async (id) => {
          try {
            await deleteDoc(doc(db, 'budgets', id));
          } catch (err) {
            console.warn('[BudgetContext] deleteDoc failed, falling back to soft-delete:', err);
            await setDoc(
              doc(db, 'budgets', id),
              {
                categorie,
                nom: categorie,
                actif: false,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
          }
        }),
      );
    },
    [budgets],
  );

  const contextValue = useMemo(
    (): BudgetContextType => ({
      viewMode,
      setViewMode,
      monthKey,
      setMonthKey,
      budgets: computedBudgets,
      loading,
      refresh,
      getBudgetCategoryCandidates,
      updateMonthlyBudget,
      updateAnnualDefault,
      updateBaseBudget,
      removeBudgetCategory,
    }),
    [
      viewMode,
      setViewMode,
      monthKey,
      setMonthKey,
      computedBudgets,
      loading,
      refresh,
      getBudgetCategoryCandidates,
      updateMonthlyBudget,
      updateAnnualDefault,
      updateBaseBudget,
      removeBudgetCategory,
    ],
  );

  return <BudgetContext.Provider value={contextValue}>{children}</BudgetContext.Provider>;
};

/** Hook interne — consomme le BudgetContext ; lever si utilisé hors BudgetProvider. */
export const useBudgetContext = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudgetContext must be used within a BudgetProvider');
  }
  return context;
};
