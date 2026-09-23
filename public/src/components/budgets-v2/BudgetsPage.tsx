import React, { useMemo, useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudget } from '../../hooks/useBudget';
import { useTransactions } from '../../hooks/useTransactions';
import { useExpenseBudget } from '../../hooks/useExpenseBudget';
import { useGlobalData } from '../../context/GlobalDataContext';
import { useAppState } from '../../context/AppStateContext';
import { buildRecurringCategorySet, isRecurringBackedCategory } from '../../utils/budgetHelpers';
import { BudgetHeaderSummary } from './BudgetHeaderSummary';
import { BudgetCategoryScopeBar } from './BudgetCategoryScopeBar';
import { BudgetCategoryList, BudgetCategoryRowVM } from './BudgetCategoryList';
import { BudgetDetailModal } from './BudgetDetailModal';
import { BudgetFormModal } from './BudgetFormModal';
import { BudgetManagerPanel } from './BudgetManagerPanel';
import { RAVEditor } from './RAVEditor';
import {
  BarChart3,
  Calendar,
  LayoutPanelTop,
  AlertTriangle,
  Filter,
  ListFilter,
  Plus,
  Settings2,
  Wallet,
  Repeat,
  ChevronDown,
} from 'lucide-react';
import { computeConsumption } from '../../api/consumption';
import { getExpectedPaceProgress } from '../../utils/date';
import { BudgetConsumption, BudgetBase } from '../../types/banking.types';
import { PageHeader } from '../shared/PageHeader';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';

export const BudgetsPage: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const { budgets, loading: budgetLoading, refresh: refreshBudgets } = useBudget();
  const { transactions } = useTransactions();
  const { recurrences } = useGlobalData();
  const totalExpenseBudget = useExpenseBudget();
  const {
    budgetCategoryScope,
    setBudgetCategoryScope,
    budgetCalculationScope,
    setBudgetCalculationScope,
    budgetPeriodMode,
    setBudgetPeriodMode,
    isBudgetScopeVisible,
    setIsBudgetScopeVisible,
  } = useAppState();

  const [selectedRaw, setSelectedConsumption] = useState<BudgetConsumption | null>(null);
  const [isAddingBudget, setIsAddingBudget] = useState(false);
  const [showAllBudgets, setShowAllBudgets] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showRavEditor, setShowRavEditor] = useState(false);
  const [showFixedCharges, setShowFixedCharges] = useState(false);

  useEffect(() => {
    // Only scroll restoration, removed data version
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const monthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const allCategoryIds = useMemo(() => {
    return Array.from(new Set(budgets.map((b) => b.id))).sort();
  }, [budgets]);

  // Initialize scope with all categories if empty
  useEffect(() => {
    if (budgetCategoryScope.length === 0 && allCategoryIds.length > 0) {
      setBudgetCategoryScope(allCategoryIds);
    }
    if (budgetCalculationScope.length === 0 && allCategoryIds.length > 0) {
      setBudgetCalculationScope(allCategoryIds);
    }
  }, [
    allCategoryIds,
    budgetCategoryScope.length,
    budgetCalculationScope.length,
    setBudgetCategoryScope,
    setBudgetCalculationScope,
  ]);

  const consumptionData = useMemo(() => {
    // When scope is empty (not yet initialized), treat all categories as included
    const effectiveCalcScope =
      budgetCalculationScope.length > 0 ? budgetCalculationScope : allCategoryIds;

    const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
    const refDate =
      budgetPeriodMode === 'year' ? new Date(year, 11, 31) : new Date(year, month - 1, 15);

    const results = budgets
      .filter((b) => {
        const isCalculated =
          effectiveCalcScope.includes(b.id) || effectiveCalcScope.includes(b.categorie);
        const isActive = b.actif !== false;
        return isActive && isCalculated;
      })
      .map((b) => {
        try {
          // Pass override for periode.type based on budgetPeriodMode
          const budgetToCompute = {
            ...b,
            periode: {
              ...(b.periode || {}),
              type: budgetPeriodMode === 'year' ? 'annee_civile' : 'mois_courant',
            },
          };
          const cons = computeConsumption(budgetToCompute, transactions, refDate);
          return cons;
        } catch (err) {
          console.error(`[BudgetsPage] Error computing ${b.nom}:`, err);
          return null;
        }
      })
      .filter(Boolean) as BudgetConsumption[];

    return results;
  }, [budgets, transactions, budgetPeriodMode, monthKey, budgetCalculationScope, allCategoryIds]);

  const displayConsumptionData = useMemo(() => {
    // 1. Filter by visibility scope
    const visible = consumptionData.filter(
      (c) => budgetCategoryScope.includes(c.budgetId) || budgetCategoryScope.includes(c.categorie),
    );

    // 2. Sort by montant descending
    return [...visible].sort((a, b) => b.montant - a.montant);
  }, [consumptionData, budgetCategoryScope]);

  // Set des catégories couvertes par une récurrence active (charges fixes).
  const recurringCategorySet = useMemo(() => buildRecurringCategorySet(recurrences), [recurrences]);

  const toRow = (c: BudgetConsumption, allowWatch: boolean): BudgetCategoryRowVM => {
    // Les charges fixes/récurrentes ne sont jamais "à surveiller" (doré) tant
    // qu'elles ne dépassent pas : seul un vrai dépassement (≥100%) reste signalé.
    let status: 'ok' | 'watch' | 'risk' = 'ok';
    if (c.pourcentage >= 100) status = 'risk';
    else if (allowWatch && c.pourcentage >= 80) status = 'watch';

    return {
      categoryId: c.budgetId,
      label: c.nom,
      spent: c.depense,
      limit: c.montant,
      consumedPct: c.pourcentage,
      theoreticalPct: (c.rythmeTheorique / c.montant) * 100,
      remaining: c.reste,
      status,
    };
  };

  // Sépare les enveloppes variables (à surveiller) des charges fixes/récurrentes.
  const { variableRows, fixedRows } = useMemo(() => {
    const variable: BudgetConsumption[] = [];
    const fixed: BudgetConsumption[] = [];
    displayConsumptionData.forEach((c) => {
      if (isRecurringBackedCategory(c.categorie || c.nom, recurringCategorySet)) fixed.push(c);
      else variable.push(c);
    });

    // Le filtre "Top" s'applique aux enveloppes variables (le focus de suivi).
    const variableShown = showAllBudgets ? variable : variable.slice(0, 10);

    return {
      variableRows: variableShown.map((c) => toRow(c, true)),
      fixedRows: fixed
        .slice()
        .sort((a, b) => {
          const rank = (pct: number) => (pct > 100 ? 0 : pct === 100 ? 2 : 1);
          return rank(a.pourcentage) - rank(b.pourcentage);
        })
        .map((c) => toRow(c, false)),
    };
  }, [displayConsumptionData, recurringCategorySet, showAllBudgets]);

  // Le détail ouvert suit les données recalculées (changement de période, etc.) ;
  // si l'enveloppe n'y figure plus, on garde la dernière version connue.
  const selectedConsumption =
    (selectedRaw && displayConsumptionData.find((c) => c.budgetId === selectedRaw.budgetId)) ||
    selectedRaw;

  const openCategory = (id: string) => {
    const consumption = displayConsumptionData.find((c) => c.budgetId === id);
    if (consumption) setSelectedConsumption(consumption);
  };

  const stats = useMemo(() => {
    const budgetTotal = totalExpenseBudget;
    const spentToDate = consumptionData.reduce((sum, c) => (c.isIncome ? sum : sum + c.depense), 0);

    return {
      budgetTotal,
      spentToDate,
      remaining: budgetTotal - spentToDate,
      consumedPct: budgetTotal > 0 ? (spentToDate / budgetTotal) * 100 : 0,
      expectedPct: getExpectedPaceProgress(
        budgetPeriodMode === 'year' ? 'annual' : 'monthly',
        monthKey,
      ),
    };
  }, [consumptionData, totalExpenseBudget, budgetPeriodMode, monthKey]);

  if (budgetLoading)
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
        <p className="text-caption font-semibold text-gold animate-pulse">
          {t({ id: 'state.loading.budgets' })}
        </p>
      </div>
    );

  return (
    <div className="pt-0 min-h-screen bg-bg">
      <PageHeader
        title={`${t({ id: 'budget.page.title' })} ${t({ id: 'budget.page.title.emphasis' })}`}
        subtitle={t({ id: 'budget.page.eyebrow' })}
        icon={<div className="w-2 h-2 rounded-full bg-gold" />}
        rightActions={
          <div className="flex gap-2 overflow-x-auto no-scrollbar items-center pb-1">
            <Button
              variant={budgetPeriodMode === 'month' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setBudgetPeriodMode('month')}
              className="text-caption flex-shrink-0"
            >
              <Calendar size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.mode.month' })}</span>
            </Button>
            <Button
              variant={budgetPeriodMode === 'year' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setBudgetPeriodMode('year')}
              className="text-caption flex-shrink-0"
            >
              <BarChart3 size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.mode.year' })}</span>
            </Button>
            <div className="w-px h-6 bg-white/10 self-center hidden md:block flex-shrink-0" />
            <Button
              variant={showAllBudgets ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowAllBudgets(!showAllBudgets)}
              className="text-caption flex-shrink-0"
            >
              <Filter size={14} aria-hidden="true" />
              <span className="hidden xl:inline">
                {showAllBudgets
                  ? t({ id: 'budget.page.filter.all' })
                  : t({ id: 'budget.page.filter.top' })}
              </span>
            </Button>
            <Button
              variant={isBudgetScopeVisible ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setIsBudgetScopeVisible(!isBudgetScopeVisible)}
              className="text-caption flex-shrink-0"
            >
              <ListFilter size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.selector' })}</span>
            </Button>
            <Button
              variant={showRavEditor ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                setShowRavEditor((v) => !v);
                if (!showRavEditor) setShowManager(false);
              }}
              className="text-caption flex-shrink-0"
            >
              <Wallet size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.rav' })}</span>
            </Button>
            <Button
              variant={showManager ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                setShowManager((v) => !v);
                if (!showManager) setShowRavEditor(false);
              }}
              className="text-caption flex-shrink-0"
            >
              <Settings2 size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.manage' })}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddingBudget(true)}
              className="text-caption flex-shrink-0"
            >
              <Plus size={14} aria-hidden="true" />
              <span className="hidden xl:inline">{t({ id: 'budget.page.new' })}</span>
            </Button>
          </div>
        }
      />

      <AnimatePresence initial={false}>
        {showRavEditor && <RAVEditor monthKey={monthKey} onClose={() => setShowRavEditor(false)} />}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {showManager && <BudgetManagerPanel onClose={() => setShowManager(false)} />}
      </AnimatePresence>

      <div className="space-y-12 md:space-y-20 py-8 md:py-12">
        <BudgetHeaderSummary {...stats} />

        <AnimatePresence>
          {isAddingBudget && (
            <BudgetFormModal
              onClose={() => setIsAddingBudget(false)}
              onSave={() => {
                setIsAddingBudget(false);
                refreshBudgets();
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isBudgetScopeVisible && (
            <motion.section
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-8 overflow-hidden"
            >
              <div className="flex items-center gap-4 px-2 md:px-4">
                <div className="p-4 rounded-lg bg-gold/5 border border-separator text-gold">
                  <LayoutPanelTop size={24} aria-hidden="true" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  {t({ id: 'budget.page.scope.title' })}{' '}
                  <span className="text-gold/40 font-light">
                    {t({ id: 'budget.page.scope.title.emphasis' })}
                  </span>
                </h2>
              </div>
              <BudgetCategoryScopeBar
                categories={budgets.map((b) => ({
                  id: b.id,
                  label: b.nom || b.categorie || b.id,
                  isCalculated:
                    budgetCalculationScope.includes(b.id) ||
                    budgetCalculationScope.includes(b.categorie),
                  included:
                    budgetCategoryScope.includes(b.id) || budgetCategoryScope.includes(b.categorie),
                }))}
                onToggleCalculation={(id) => {
                  const b = budgets.find((x) => x.id === id || x.categorie === id);
                  const targetId = b ? b.id : id;
                  if (budgetCalculationScope.includes(targetId))
                    setBudgetCalculationScope(budgetCalculationScope.filter((c) => c !== targetId));
                  else setBudgetCalculationScope([...budgetCalculationScope, targetId]);
                }}
                onToggleCategory={(id) => {
                  const b = budgets.find((x) => x.id === id || x.categorie === id);
                  const targetId = b ? b.id : id;
                  if (budgetCategoryScope.includes(targetId))
                    setBudgetCategoryScope(budgetCategoryScope.filter((c) => c !== targetId));
                  else setBudgetCategoryScope([...budgetCategoryScope, targetId]);
                }}
                onIncludeAll={() => setBudgetCategoryScope(allCategoryIds)}
                onExcludeAll={() => setBudgetCategoryScope([])}
                onReset={() => {
                  setBudgetCalculationScope(allCategoryIds);
                  setBudgetCategoryScope(allCategoryIds);
                }}
              />
            </motion.section>
          )}
        </AnimatePresence>

        <section className="px-2 md:px-4 pb-20 space-y-12">
          {variableRows.length > 0 || fixedRows.length > 0 ? (
            <>
              {variableRows.length > 0 ? (
                <BudgetCategoryList rows={variableRows} onOpenCategory={openCategory} />
              ) : (
                <p className="text-center text-label/30 text-xs py-8">
                  Aucune enveloppe variable à surveiller ce mois.
                </p>
              )}

              {fixedRows.length > 0 && (
                <div className="space-y-6">
                  <button
                    onClick={() => setShowFixedCharges((v) => !v)}
                    className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-lg bg-surface border border-separator hover:bg-white/[0.05] transition-colors"
                    aria-expanded={showFixedCharges}
                  >
                    <span className="flex items-center gap-4">
                      <span className="p-2 rounded-xl bg-white/5 text-label/40">
                        <Repeat size={16} aria-hidden="true" />
                      </span>
                      <span className="text-left">
                        <span className="block text-sm font-bold text-white tracking-wide">
                          Charges fixes & récurrentes
                        </span>
                        <span className="block text-caption text-label/40">
                          {fixedRows.length} enveloppe{fixedRows.length > 1 ? 's' : ''} prévisible
                          {fixedRows.length > 1 ? 's' : ''}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`text-label/40 transition-transform ${showFixedCharges ? 'rotate-180' : ''}`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {showFixedCharges && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <BudgetCategoryList rows={fixedRows} onOpenCategory={openCategory} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          ) : (
            <Card
              variant="subtle"
              className="py-20 flex flex-col items-center justify-center text-center gap-6 border-dashed"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-label/20">
                <AlertTriangle size={32} aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-white font-bold text-sm">
                  {t({ id: 'budget.page.empty.title' })}
                </p>
                <p className="text-label/40 text-xs max-w-xs mx-auto">
                  {t({ id: 'budget.page.empty.description' })}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => setBudgetCategoryScope(allCategoryIds)}
                className="text-caption"
              >
                {t({ id: 'budget.page.empty.reset' })}
              </Button>
            </Card>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedConsumption && (
          <BudgetDetailModal
            consumption={selectedConsumption}
            budget={budgets.find((b) => b.id === selectedConsumption.budgetId) as BudgetBase}
            onClose={() => setSelectedConsumption(null)}
            onSave={refreshBudgets}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
