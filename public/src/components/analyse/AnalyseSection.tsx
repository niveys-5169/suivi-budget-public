import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, RotateCcw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useTransactions,
  type Transaction,
  type TransactionFilters as ContextFilters,
} from '../../hooks/useTransactions';
import { useBudget } from '../../hooks/useBudget';
import { useExpenseBudget } from '../../hooks/useExpenseBudget';
import { useAppState } from '../../context/AppStateContext';
import {
  buildCategoryList as buildCategoryListPure,
  detectIncomeCategories,
  buildSimplifiedBuckets,
  computeCategoryGroups,
  computeIncomeBudget,
  computeSpentInBudget,
} from '../../utils/analyseAggregations';
import { MonthNavigator } from '../shared/MonthNavigator';
import { PageHeader } from '../shared/PageHeader';
import { TransactionFilters } from '../TransactionFilters';
import { AnalyseTabs } from './AnalyseTabs';
import { hideLoader } from '../../utils/loader';
import { AnalyseDonutCard } from './AnalyseDonutCard';
import { AnalyseCategoryRow } from './AnalyseCategoryRow';
import { AnalyseOverviewTab } from './AnalyseOverviewTab';
import { MonthlySavingsCard } from './MonthlySavingsCard';
import { AnalyseSimplifiedView } from './AnalyseSimplifiedView';
import { AnalyseDrillDownModal } from './AnalyseDrillDownModal';
import { TransactionFormModal } from '../TransactionFormModal';
import { useBalances } from '../../hooks/useBalances';
import { useMonthlySavingsPosition } from '../../hooks/useMonthlySavingsPosition';
import type {
  AnalyseTab,
  DrillDownView,
  CategorySummary,
  SimplifiedBucketData,
} from './analyseTypes';

export const AnalyseSection: React.FC = () => {
  const {
    transactions,
    filteredTransactions,
    filters,
    updateFilters,
    resetFilters,
    pointAll,
    unpointAll,
    saveTransaction,
    deleteTransaction,
  } = useTransactions();
  const { budgets, getBudgetCategoryCandidates } = useBudget();
  const { balances } = useBalances();
  const { budgetCalculationScope } = useAppState();
  const totalExpenseBudget = useExpenseBudget();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AnalyseTab>('overview');
  // Dérivé des filtres : handleMonthChange ne fait que les mettre à jour.
  const currentMonth = useMemo(() => {
    const y = parseInt(filters.year) || new Date().getFullYear();
    const m = parseInt(filters.month) || new Date().getMonth() + 1;
    return new Date(y, m - 1, 1);
  }, [filters.year, filters.month]);
  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthlySavings = useMonthlySavingsPosition(monthKey, transactions);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleEditTransaction = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setIsEditModalOpen(true);
  }, []);

  const handleSaveTransaction = async (txData: Partial<Transaction> & { id?: string }) => {
    try {
      await saveTransaction(txData);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to save transaction:', err);
      throw err;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      throw err;
    }
  };

  const handleMonthChange = (date: Date) => {
    updateFilters({
      year: date.getFullYear().toString(),
      month: String(date.getMonth() + 1).padStart(2, '0'),
    });
  };

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [sortiesSubView, setSortiesSubView] = useState<'categories' | 'simplifie'>('categories');
  const [drillDown, setDrillDown] = useState<DrillDownView | null>(null);
  const [drillDownStack, setDrillDownStack] = useState<DrillDownView[]>([]);

  const categories = useMemo(() => {
    const candidates = getBudgetCategoryCandidates();
    const fromCurrentTxs = new Set(
      filteredTransactions.map((t) => (t.categorie || '').trim()).filter(Boolean),
    );
    return Array.from(new Set([...candidates, ...fromCurrentTxs])).sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
  }, [getBudgetCategoryCandidates, filteredTransactions]);

  const accounts = useMemo(() => {
    return Array.from(new Set(balances.map((b) => b.compte)))
      .filter(Boolean)
      .sort();
  }, [balances]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  }, []);

  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('analyse_hidden_categories');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(
        'analyse_hidden_categories',
        JSON.stringify(Array.from(hiddenCategories)),
      );
    } catch {
      /* ignore */
    }
  }, [hiddenCategories]);

  React.useEffect(() => {
    hideLoader();
  }, []);

  // Sélection du graphique remise à zéro au changement d'onglet ou de mois.
  const selectionKey = `${activeTab}|${monthKey}`;
  const [selectionResetKey, setSelectionResetKey] = useState(selectionKey);
  if (selectionKey !== selectionResetKey) {
    setSelectionResetKey(selectionKey);
    setActiveIndex(null);
  }

  const buildCategoryList = useCallback(
    (
      groups: Record<string, { amount: number; count: number }>,
      visibleTotal: number,
      skipHidden: boolean,
      tab: AnalyseTab,
    ): CategorySummary[] =>
      buildCategoryListPure(groups, visibleTotal, skipHidden, tab, { hiddenCategories, budgets }),
    [hiddenCategories, budgets],
  );

  const { allCategories, visibleCategories, total, rawTransactions, totalEntrees, totalSorties } =
    useMemo(() => {
      const {
        groups,
        visibleTotal,
        rawTransactions: rawTx,
        totalEntrees: tEntrees,
        totalSorties: tSorties,
      } = computeCategoryGroups(filteredTransactions, activeTab, hiddenCategories);

      return {
        allCategories: buildCategoryList(groups, visibleTotal, false, activeTab),
        visibleCategories: buildCategoryList(groups, visibleTotal, true, activeTab),
        total: visibleTotal,
        rawTransactions: rawTx,
        totalEntrees: tEntrees,
        totalSorties: tSorties,
      };
    }, [filteredTransactions, activeTab, hiddenCategories, buildCategoryList]);

  const accountCount = useMemo(() => {
    return new Set(filteredTransactions.map((tx) => tx.compte).filter(Boolean)).size;
  }, [filteredTransactions]);

  const incomeCats = useMemo<Set<string>>(
    () => detectIncomeCategories(transactions || []),
    [transactions],
  );

  const totalIncomeBudget = useMemo(
    () => computeIncomeBudget(budgets, budgetCalculationScope, incomeCats),
    [budgets, budgetCalculationScope, incomeCats],
  );

  const totalSpentInBudget = useMemo(
    () => computeSpentInBudget(rawTransactions, budgets, budgetCalculationScope),
    [rawTransactions, budgets, budgetCalculationScope],
  );

  const simplifiedBuckets = useMemo(
    (): SimplifiedBucketData[] => buildSimplifiedBuckets(allCategories),
    [allCategories],
  );

  const handleDrillDown = useCallback(
    (view: DrillDownView) => {
      if (drillDown) setDrillDownStack((prev) => [...prev, drillDown]);
      setDrillDown(view);
      if (view.type === 'category') {
        const idx = visibleCategories.findIndex((c) => c.name === view.categoryName);
        setActiveIndex(idx !== -1 ? idx : null);
      }
    },
    [drillDown, visibleCategories],
  );

  const handleBack = useCallback(() => {
    if (drillDownStack.length > 0) {
      const prev = drillDownStack[drillDownStack.length - 1]!;
      setDrillDownStack((s) => s.slice(0, -1));
      setDrillDown(prev);
    } else {
      setDrillDown(null);
      setActiveIndex(null);
    }
  }, [drillDownStack]);

  const handleTabChange = useCallback((tab: AnalyseTab) => {
    setActiveTab(tab);
    setDrillDown(null);
    setDrillDownStack([]);
    setActiveIndex(null);
  }, []);

  const toggleHide = useCallback(
    (name: string) => {
      setHiddenCategories((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
      setActiveIndex((prev) => {
        if (prev === null) return null;
        const visIdx = visibleCategories.findIndex((c) => c.name === name);
        return prev === visIdx ? null : prev;
      });
    },
    [visibleCategories],
  );

  const handleRowClick = useCallback(
    (name: string) => {
      handleDrillDown({
        type: 'category',
        categoryName: name,
        tab: activeTab === 'entrees' ? 'entrees' : 'sorties',
      });
    },
    [handleDrillDown, activeTab],
  );

  const hiddenCount = hiddenCategories.size;

  const donutLabel = activeTab === 'entrees' ? 'Revenus' : 'Dépenses';

  return (
    <div className="min-h-screen bg-bg">
      <PageHeader title="Analyse" />

      <div className="px-4 md:px-6 space-y-4 mt-6">
        {/* Ambient glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/5 blur-[120px] rounded-full -z-10" />

        <div className="bg-bg/80 backdrop-blur-xl border border-separator rounded-xl px-4 mb-4">
          <TransactionFilters
            filters={filters}
            onFilterChange={(name, value) =>
              updateFilters({ [name]: value } as Partial<ContextFilters>)
            }
            onReset={resetFilters}
            onPointAll={pointAll}
            onUnpointAll={unpointAll}
            categories={categories}
            years={years}
            accounts={accounts}
          />
        </div>

        <MonthNavigator month={currentMonth} onChange={handleMonthChange} />
        <AnalyseTabs activeTab={activeTab} onChange={handleTabChange} />

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <MonthlySavingsCard
              position={monthlySavings.position}
              loading={monthlySavings.loading}
              error={monthlySavings.error}
            />
            <AnalyseOverviewTab
              totalEntrees={totalEntrees}
              totalSorties={totalSorties}
              totalBudget={totalExpenseBudget}
              totalSpent={totalSpentInBudget}
              accountCount={accountCount}
              onDrillDown={handleDrillDown}
              onNavigateBudgets={() => navigate('/budgets')}
            />
          </div>
        )}

        {/* Entrées / Sorties tabs */}
        {(activeTab === 'entrees' || activeTab === 'sorties') && (
          <>
            <motion.div layout>
              <AnalyseDonutCard
                data={visibleCategories}
                total={total}
                label={donutLabel}
                activeIndex={activeIndex}
                onSegmentClick={(idx) => {
                  if (idx !== null) {
                    setActiveIndex(idx);
                    const cat = visibleCategories[idx];
                    if (cat)
                      handleDrillDown({
                        type: 'category',
                        categoryName: cat.name,
                        tab: activeTab === 'entrees' ? 'entrees' : 'sorties',
                      });
                  } else {
                    setActiveIndex(null);
                  }
                }}
                accountCount={accountCount}
                onAccountsClick={() => handleDrillDown({ type: 'accounts' })}
                budgetSpent={totalSpentInBudget}
                budgetTotal={
                  activeTab === 'sorties'
                    ? totalExpenseBudget
                    : activeTab === 'entrees'
                      ? totalIncomeBudget
                      : 0
                }
                onBudgetClick={() => navigate('/budgets')}
              />
            </motion.div>

            {/* Catégories / Simplifié toggle (sorties only) */}
            {activeTab === 'sorties' && (
              <div className="flex p-1 gap-1 bg-surface border border-separator rounded-lg">
                {(['categories', 'simplifie'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setSortiesSubView(v)}
                    className={[
                      'relative flex-1 py-2 text-caption font-bold rounded-xl transition-colors duration-300',
                      sortiesSubView === v
                        ? 'text-bg'
                        : 'text-label-tertiary hover:text-label-secondary',
                    ].join(' ')}
                  >
                    {sortiesSubView === v && (
                      <motion.div
                        layoutId="sortiesToggle"
                        className="absolute inset-0 bg-gold rounded-xl"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      />
                    )}
                    <span className="relative z-10">
                      {v === 'categories' ? 'Catégories' : 'Simplifié'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Simplifié view */}
            {activeTab === 'sorties' && sortiesSubView === 'simplifie' && (
              <AnalyseSimplifiedView buckets={simplifiedBuckets} onDrillDown={handleDrillDown} />
            )}

            {/* Catégories view */}
            {(activeTab === 'entrees' || sortiesSubView === 'categories') && (
              <>
                <div className="flex items-center justify-between px-2 gap-2 flex-wrap">
                  <h3 className="text-caption font-bold text-label-tertiary truncate min-w-0">
                    Répartition par catégorie
                  </h3>
                  <div className="flex items-center gap-4 shrink-0 flex-wrap">
                    {hiddenCount > 0 && (
                      <button
                        onClick={() => {
                          setHiddenCategories(new Set());
                          setActiveIndex(null);
                        }}
                        className="flex items-center gap-2 text-caption font-bold text-label-secondary hover:text-gold transition-colors whitespace-nowrap"
                      >
                        <EyeOff size={11} />
                        {hiddenCount} masquée{hiddenCount > 1 ? 's' : ''}
                        <RotateCcw size={10} className="ml-1" />
                      </button>
                    )}
                    <button
                      onClick={() => navigate('/budgets')}
                      className="flex items-center gap-1 text-caption font-bold text-label-tertiary hover:text-gold transition-colors whitespace-nowrap"
                      title="Créer une catégorie"
                    >
                      <Plus size={11} />
                      Catégorie
                    </button>
                  </div>
                </div>

                <motion.div
                  layout
                  className="bg-surface rounded-xl overflow-hidden divide-y divide-separator border border-separator"
                >
                  <AnimatePresence mode="popLayout">
                    {allCategories.map((cat) => {
                      const isHidden = hiddenCategories.has(cat.name);
                      const visibleIdx = visibleCategories.findIndex((c) => c.name === cat.name);
                      const isActive = !isHidden && visibleIdx !== -1 && activeIndex === visibleIdx;
                      const displayPct = isHidden
                        ? 0
                        : (visibleCategories[visibleIdx]?.percentage ?? 0);

                      return (
                        <AnalyseCategoryRow
                          key={cat.name}
                          name={cat.name}
                          amount={cat.amount}
                          count={cat.count}
                          percentage={displayPct}
                          color={cat.color}
                          isActive={isActive}
                          isHidden={isHidden}
                          onClick={() => handleRowClick(cat.name)}
                          onToggleHide={(e) => {
                            e.stopPropagation();
                            toggleHide(cat.name);
                          }}
                        />
                      );
                    })}

                    {allCategories.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-16 text-center text-label-tertiary text-sm"
                      >
                        Aucune transaction pour cette période.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </>
            )}
          </>
        )}
      </div>

      <AnalyseDrillDownModal
        drillDown={drillDown}
        onBack={handleBack}
        rawTransactions={rawTransactions}
        allCategories={allCategories}
        allTransactions={transactions}
        monthKey={monthKey}
        onTransactionClick={handleEditTransaction}
        onDrillDown={handleDrillDown}
      />

      <TransactionFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        transaction={editingTransaction}
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
};
