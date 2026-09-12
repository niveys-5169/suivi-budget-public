import React, { useMemo, useState, useCallback } from 'react';
import { useBudget } from '../../../hooks/useBudget';
import { useDashboard } from '../../../hooks/useDashboard';
import { useTransactionContext, Transaction } from '../../../context/TransactionContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Zap, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { AurumBudgetDetail } from './AurumBudgetDetail';
import { AurumTransactionDetail } from './AurumTransactionDetail';
import { AurumBudgetGlobalFocus } from './AurumBudgetGlobalFocus';
import { getBudgetedMonthlyIncome, isIncomeBudget } from '../../../utils/budgetHelpers';
import { getExpectedPaceProgress } from '../../../utils/date';
import { formatCurrency } from '../../../lib/formatters';
import { parseDecimal } from '../../../utils/format';
import { EmptyState } from '../../shared/EmptyState';

const AurumBudgetGauge: React.FC<{ spent: number; total: number; label: string }> = ({
  spent,
  total,
  label,
}) => {
  const percentage = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const isOver = spent > total;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-white/5"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={440}
            initial={{ strokeDashoffset: 440 }}
            animate={{ strokeDashoffset: 440 - (440 * percentage) / 100 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={isOver ? 'text-negative' : 'text-gold'}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-caption font-semibold text-label-tertiary">{label}</span>
          <span className="text-2xl font-bold tracking-tighter tabular-nums">
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export const AurumBudgetPage: React.FC = () => {
  const {
    budgets = [],
    updateBaseBudget,
    updateAnnualDefault,
    viewMode: view,
    setViewMode,
  } = useBudget() || {};
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [sortMode, setSortMode] = useState<'amount' | 'name'>('name');

  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('aurum_budget_selection');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCategory = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnabledCategories((prev) => {
      const next = { ...prev, [cat]: prev[cat] === false ? true : false };
      localStorage.setItem('aurum_budget_selection', JSON.stringify(next));
      return next;
    });
  };

  const isEnabled = useCallback(
    (cat: string) => enabledCategories[cat] !== false,
    [enabledCategories],
  );

  const { stats = { totalRec: 0, totalDep: 0 }, monthKey, shiftMonth } = useDashboard() || {};
  const { transactions = [], saveTransaction, deleteTransaction } = useTransactionContext() || {};

  const sortedBudgets = useMemo(() => {
    if (!Array.isArray(budgets)) return [];
    return [...budgets].sort((a, b) => {
      if (sortMode === 'amount') return (Number(b.montant) || 0) - (Number(a.montant) || 0);
      return a.categorie.localeCompare(b.categorie);
    });
  }, [budgets, sortMode]);

  const safeMonthKey = monthKey || new Date().toISOString().slice(0, 7);
  const [yearStr = ''] = safeMonthKey.split('-');

  // O(N) optimization: Group spent amount by category once per snapshot
  const monthlySpentByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!Array.isArray(transactions)) return counts;

    transactions.forEach((t) => {
      if (t?.date?.startsWith(safeMonthKey)) {
        const cat = t.categorie || 'Non catégorisé';
        counts[cat] = (counts[cat] || 0) + (Number(t.montant) || 0);
      }
    });

    // Convert net flow to absolute spent (clamped to 0 for display)
    Object.keys(counts).forEach((cat) => {
      counts[cat] = Math.max(0, -(counts[cat] ?? 0));
    });
    return counts;
  }, [transactions, safeMonthKey]);

  const monthName = useMemo(() => {
    const [y, m] = safeMonthKey.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }, [safeMonthKey]);

  // Compute stats with deep safety
  const annualStats = useMemo(() => {
    const currentYear = yearStr || new Date().getFullYear().toString();
    const yearTransactions = Array.isArray(transactions)
      ? transactions.filter((t) => t?.date?.startsWith(currentYear))
      : [];
    // Total dépensé = -netFlow (les remboursements > 0 réduisent la consommation), clampé à 0.
    const totalSpentYear = Math.max(0, -yearTransactions.reduce((s, t) => s + (t.montant || 0), 0));

    // Budgets are already scaled by viewMode in BudgetContext
    // In monthly view, b.montant is monthly amount, so multiply by 12 for annual
    // In annual view, b.montant is already annual
    const totalBudgetYear = Array.isArray(budgets)
      ? budgets
          .filter((b) => !isIncomeBudget(b))
          .reduce((s, b) => {
            const baseAmount = Number(b.montant) || 0;
            const annualAmount = view === 'monthly' ? baseAmount * 12 : baseAmount;
            return s + annualAmount;
          }, 0)
      : 0;

    const categoryYearly: Record<string, { spent: number; budget: number }> = {};
    if (Array.isArray(budgets)) {
      budgets.forEach((b) => {
        if (isIncomeBudget(b)) return;
        // -dépenses + revenus : netFlow signé puis clamp pour le "consommé" affiché.
        const netFlow = yearTransactions
          .filter((t) => t.categorie === b.categorie)
          .reduce((s, t) => s + (t.montant || 0), 0);
        const catSpent = Math.max(0, -netFlow);
        const baseAmount = Number(b.montant) || 0;
        const annualAmount = view === 'monthly' ? baseAmount * 12 : baseAmount;
        categoryYearly[b.categorie] = {
          spent: catSpent,
          budget: annualAmount,
        };
      });
    }

    return { totalSpentYear, totalBudgetYear, categoryYearly };
  }, [transactions, budgets, yearStr, view]);

  const burnRate = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const timeProgress = (currentDay / daysInMonth) * 100;

    // Le total de référence est le budget mensuel de revenus.
    const totalBudget = getBudgetedMonthlyIncome(budgets, view, transactions);

    // La barre se remplit avec les dépenses mensuelles réelles.
    const budgetProgress =
      totalBudget > 0 ? (Math.abs(stats.totalDep || 0) / totalBudget) * 100 : 0;
    return { timeProgress, budgetProgress, isOverSpeed: budgetProgress > timeProgress };
  }, [budgets, stats.totalDep, view, transactions]);

  const globalFocus = useMemo(() => {
    const activeBudgets = Array.isArray(budgets)
      ? budgets.filter((b) => isEnabled(b.categorie))
      : [];
    const activeCatSet = new Set(activeBudgets.map((b) => b.categorie));

    const incomeActual = Array.isArray(transactions)
      ? transactions
          .filter(
            (t) =>
              t?.date?.startsWith(safeMonthKey) &&
              (t.montant || 0) > 0 &&
              activeCatSet.has(t.categorie || ''),
          )
          .reduce((s, t) => s + (t.montant || 0), 0)
      : 0;

    const expenseActual = Array.isArray(transactions)
      ? Math.abs(
          transactions
            .filter(
              (t) =>
                t?.date?.startsWith(safeMonthKey) &&
                (t.montant || 0) < 0 &&
                activeCatSet.has(t.categorie || ''),
            )
            .reduce((s, t) => s + (t.montant || 0), 0),
        )
      : 0;

    const expenseBudget = activeBudgets
      .filter((b) => !isIncomeBudget(b))
      .reduce((s, b) => s + (Number(b.montant) || 0), 0);
    const incomeBudget = getBudgetedMonthlyIncome(activeBudgets, view, transactions);

    return {
      income: { actual: incomeActual, budget: incomeBudget },
      expenses: { actual: expenseActual, budget: expenseBudget },
      net: { actual: incomeActual - expenseActual, budget: incomeBudget - expenseBudget },
      expectedPct: getExpectedPaceProgress('monthly', safeMonthKey),
    };
  }, [budgets, transactions, safeMonthKey, isEnabled, view]);

  const detailData = useMemo(() => {
    if (!selectedCategory || !Array.isArray(budgets)) return null;
    const b = budgets.find((b) => b.categorie === selectedCategory);
    if (!b) return null;

    const filteredTx = Array.isArray(transactions)
      ? transactions.filter(
          (t) =>
            t.categorie === selectedCategory &&
            (view === 'monthly' ? t?.date?.startsWith(safeMonthKey) : t?.date?.startsWith(yearStr)),
        )
      : [];
    // -dépenses + revenus : les remboursements (montants positifs) viennent diminuer la consommation.
    const netFlow = filteredTx.reduce((s, t) => s + (t.montant || 0), 0);
    const spent = Math.max(0, -netFlow);

    // b.montant is already correctly scaled by viewMode in BudgetContext
    const budgetVal = Number(b.montant) || 0;

    const timeProgress =
      view === 'annual'
        ? (() => {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const endOfYear = new Date(now.getFullYear(), 11, 31);
            const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
            const daysPassed = (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
            return (daysPassed / totalDays) * 100;
          })()
        : burnRate.timeProgress;

    return {
      category: selectedCategory,
      spent,
      budget: budgetVal,
      transactions: filteredTx,
      timeProgress,
      viewMode: view,
    };
  }, [selectedCategory, budgets, transactions, safeMonthKey, view, burnRate.timeProgress, yearStr]);

  const handleAddBudget = () => {
    const cat = window.prompt('Nom de la catégorie ?');
    if (!cat) return;
    const promptMsg = view === 'monthly' ? 'Montant mensuel ?' : 'Montant annuel ?';
    const amt = window.prompt(promptMsg);
    const val = amt ? parseDecimal(amt) : null;
    if (val !== null) {
      if (view === 'monthly') {
        if (updateBaseBudget) updateBaseBudget(cat, val, 'mensuel');
      } else {
        if (updateAnnualDefault) updateAnnualDefault(cat, val);
        if (updateBaseBudget) updateBaseBudget(cat, val, 'annuel');
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30 pb-40">
      <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />

      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold tracking-tighter text-white">Pilotage Budgétaire</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-caption font-semibold text-gold/60">
              {view === 'monthly' ? monthName : 'Vision Consolidée ' + yearStr}
            </p>
            {view === 'monthly' && (
              <div className="flex items-center gap-1 ml-1 text-gold/40">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="hover:text-gold transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => shiftMonth(1)} className="hover:text-gold transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex bg-surface border border-separator p-1 rounded-lg">
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${view === 'monthly' ? 'bg-gold text-bg' : 'text-white/40'}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setViewMode('annual')}
            className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${view === 'annual' ? 'bg-gold text-bg' : 'text-white/40'}`}
          >
            Annuel
          </button>
        </div>
      </nav>

      <main className="px-6 space-y-12">
        {view === 'monthly' && <AurumBudgetGlobalFocus {...globalFocus} />}

        {view === 'annual' ? (
          <section className="flex flex-col items-center py-10 bg-surface border border-separator rounded-xl space-y-10">
            <AurumBudgetGauge
              spent={annualStats.totalSpentYear}
              total={annualStats.totalBudgetYear}
              label="Année Écoulée"
            />
            <div className="text-center space-y-2">
              <p className="text-caption font-semibold text-label-tertiary">Reste à vivre annuel</p>
              <p className="text-4xl font-serif font-bold text-white tabular-nums">
                {formatCurrency(annualStats.totalBudgetYear - annualStats.totalSpentYear)}
              </p>
            </div>
          </section>
        ) : (
          <section className="relative group">
            <div
              className={`absolute -inset-1 blur-2xl opacity-20 transition-opacity ${burnRate.isOverSpeed ? 'bg-negative/40' : 'bg-positive'}`}
            />
            <div className="relative rounded-xl p-10 bg-surface border border-separator backdrop-blur-3xl space-y-10">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-caption font-bold text-label-tertiary">Vitesse de Dépense</p>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {burnRate.isOverSpeed ? 'Consommation Rapide' : 'Rythme Maîtrisé'}
                  </h2>
                </div>
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center border transition-colors ${burnRate.isOverSpeed ? 'bg-negative/10 border-negative/20 text-negative' : 'bg-positive/10 border-positive/20 text-positive'}`}
                >
                  <Zap size={22} strokeWidth={2.5} />
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between text-caption font-semibold">
                    <span className="text-label-tertiary">Budget Consommé</span>
                    <span className={burnRate.isOverSpeed ? 'text-negative' : 'text-positive'}>
                      {burnRate.budgetProgress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-1 border border-separator">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(burnRate.budgetProgress, 100)}%` }}
                      className={`h-full rounded-full ${burnRate.isOverSpeed ? 'bg-negative' : 'bg-positive'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-bold tracking-tight">Détail des Enveloppes</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSortMode((prev) => (prev === 'amount' ? 'name' : 'amount'))}
                className="px-4 py-2 rounded-xl bg-white/5 border border-separator text-caption font-semibold text-white/40 hover:text-gold hover:border-gold/30 transition-all"
              >
                Tri: {sortMode === 'amount' ? 'Montant' : 'Nom'}
              </button>
              <button
                onClick={handleAddBudget}
                className="px-4 py-2 rounded-xl bg-gold text-bg text-caption font-semibold hover:scale-105 active:scale-95 transition-all"
              >
                + Ajouter
              </button>
            </div>
          </div>
          <div className="space-y-4">
            {sortedBudgets.length === 0 && (
              <EmptyState
                icon={<Target size={32} />}
                title="Aucun budget"
                description="Créez votre première enveloppe pour suivre vos dépenses par catégorie."
                action={{ label: 'Créer un budget', onClick: handleAddBudget }}
              />
            )}
            {sortedBudgets.map((b, _i) => {
              const spent =
                view === 'monthly'
                  ? monthlySpentByCategory[b.categorie] || 0
                  : annualStats.categoryYearly[b.categorie]?.spent || 0;

              const total = Number(b.montant) || 0;
              const pct = total > 0 ? (spent / total) * 100 : 0;
              const enabled = isEnabled(b.categorie);

              return (
                <motion.div
                  key={b.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(b.categorie)}
                  className={`bg-surface border rounded-xl p-6 space-y-6 group transition-all cursor-pointer ${enabled ? 'border-separator opacity-100' : 'border-transparent opacity-40'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => toggleCategory(b.categorie, e)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${enabled ? 'bg-gold border-gold text-bg' : 'bg-white/5 border-separator text-transparent'}`}
                      >
                        <Check size={12} strokeWidth={4} />
                      </button>
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-gold">
                        <Target size={20} />
                      </div>
                      <div>
                        <p className="text-footnote font-semibold text-white">{b.categorie}</p>
                        <p className="text-caption font-bold text-label-tertiary mt-1">
                          {spent.toFixed(0)} € dépensés
                        </p>
                      </div>
                    </div>
                    <p className="font-serif text-callout font-semibold text-white tabular-nums">
                      {formatCurrency(total)}
                    </p>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(pct, 100)}%` }}
                      className={`h-full rounded-full ${pct > 100 ? 'bg-negative' : 'bg-gold/40'}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedCategory && detailData && (
          <AurumBudgetDetail
            {...detailData}
            onClose={() => setSelectedCategory(null)}
            onTransactionClick={(txId) => {
              const tx = transactions.find((t) => t.id === txId);
              if (tx) setSelectedTx(tx);
            }}
          />
        )}
        {selectedTx && (
          <AurumTransactionDetail
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onSave={saveTransaction}
            onDelete={deleteTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
