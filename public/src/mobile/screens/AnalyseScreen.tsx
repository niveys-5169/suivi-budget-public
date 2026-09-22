import React, { useMemo, useState, useCallback } from 'react';
import { MScreenHeader } from '../components/MScreenHeader';
import { MMonthNavigator } from '../components/MMonthNavigator';
import { MSegmentedControl, AnalyseMode } from '../components/MSegmentedControl';
import { MDashboardSummary } from '../components/MDashboardSummary';
import { MCategoryDonut } from '../components/MCategoryDonut';
import { MCategoryRow } from '../components/MCategoryRow';
import { MCategoryDrillDown } from '../components/MCategoryDrillDown';
import { TransactionFormModal } from '../../components/TransactionFormModal';
import { useTransactions } from '../../hooks/useTransactions';
import { useFormOptions } from '../../hooks/useFormOptions';
import { useAppState } from '../../context/AppStateContext';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import type { Transaction } from '../../types/banking.types';
import { useMonthlySavingsPosition } from '../../hooks/useMonthlySavingsPosition';
import { MonthlySavingsCard } from '../../components/analyse/MonthlySavingsCard';

export const AnalyseScreen: React.FC = () => {
  const { monthKey, setMonthKey } = useAppState();
  const { transactions, loading, saveTransaction, deleteTransaction } = useTransactions();
  const { categories, accounts } = useFormOptions();
  const monthlySavings = useMonthlySavingsPosition(monthKey, transactions);
  const [mode, setMode] = useState<AnalyseMode>('sorties');

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

  const toggleHideCategory = useCallback((categoryName: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }, []);

  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => (tx.moisAffectation || tx.date || '').startsWith(monthKey));
  }, [transactions, monthKey]);

  const summary = useMemo(() => {
    const isVisible = (t: { categorie?: string }) =>
      !hiddenCategories.has(t.categorie || 'Non catégorisé');
    const entrees = monthTransactions
      .filter((t) => (t.montant || 0) > 0 && isVisible(t))
      .reduce((s, t) => s + (t.montant || 0), 0);
    const sorties = monthTransactions
      .filter((t) => (t.montant || 0) < 0 && isVisible(t))
      .reduce((s, t) => s + (t.montant || 0), 0);
    return { entrees, sorties };
  }, [monthTransactions, hiddenCategories]);

  const categoryData = useMemo(() => {
    const agg: Record<string, number> = {};
    const targetTxs =
      mode === 'entrees'
        ? monthTransactions.filter((t) => (t.montant || 0) > 0)
        : monthTransactions.filter((t) => (t.montant || 0) < 0);

    targetTxs.forEach((tx) => {
      const cat = tx.categorie || 'Non catégorisé';
      agg[cat] = (agg[cat] || 0) + Math.abs(tx.montant || 0);
    });

    // Compute total with hidden categories excluded
    const visibleTotal = Object.entries(agg)
      .filter(([name]) => !hiddenCategories.has(name))
      .reduce((sum, [, amount]) => sum + amount, 0);

    const result = Object.entries(agg)
      .filter(([name]) => !hiddenCategories.has(name))
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: visibleTotal > 0 ? (amount / visibleTotal) * 100 : 0,
        color: getCategoryMeta(name).color,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { items: result, total: visibleTotal };
  }, [monthTransactions, mode, hiddenCategories]);

  const donutData = useMemo(() => {
    const items = categoryData.items;
    if (items.length <= 8) {
      return items.map((i) => ({ name: i.name, value: i.amount, color: i.color }));
    }

    const top7 = items.slice(0, 7);
    const others = items.slice(7);
    const othersAmount = others.reduce((s, i) => s + i.amount, 0);

    return [
      ...top7.map((i) => ({ name: i.name, value: i.amount, color: i.color })),
      { name: 'Autres', value: othersAmount, color: '#8B8B8B' },
    ];
  }, [categoryData]);

  // Get transactions for drilldown
  const drillDownTransactions = useMemo(() => {
    if (!drillDownCategory) return [];
    let targetTxs: typeof monthTransactions;
    if (mode === 'entrees') {
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) > 0);
    } else if (mode === 'sorties') {
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) < 0);
    } else {
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) < 0);
    }
    return targetTxs.filter((t) => (t.categorie || 'Non catégorisé') === drillDownCategory);
  }, [drillDownCategory, monthTransactions, mode]);

  if (drillDownCategory) {
    const drillDownAmount = drillDownTransactions.reduce((s, t) => s + Math.abs(t.montant || 0), 0);
    const drillDownColor = getCategoryMeta(drillDownCategory).color;
    return (
      <div className="flex flex-col h-full">
        <MCategoryDrillDown
          categoryName={drillDownCategory}
          transactions={drillDownTransactions}
          color={drillDownColor}
          totalSpent={drillDownAmount}
          onBack={() => {
            setDrillDownCategory(null);
            setSelectedTransaction(null);
          }}
          onTransactionClick={(tx) => setSelectedTransaction(tx)}
        />

        <TransactionFormModal
          isOpen={selectedTransaction !== null}
          onClose={() => setSelectedTransaction(null)}
          transaction={selectedTransaction}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          categories={categories}
          accounts={accounts}
        />
      </div>
    );
  }

  if (loading && monthTransactions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <MScreenHeader title="Analyse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-8">
      <MScreenHeader title="Analyse" />

      <MMonthNavigator monthKey={monthKey} onChange={setMonthKey} />

      <div className="px-4">
        <MonthlySavingsCard
          position={monthlySavings.position}
          loading={monthlySavings.loading}
          error={monthlySavings.error}
        />
      </div>

      <MDashboardSummary entrees={summary.entrees} sorties={summary.sorties} />

      <MSegmentedControl value={mode} onChange={setMode} />

      <MCategoryDonut
        data={donutData}
        total={categoryData.total}
        label={mode === 'entrees' ? 'Total Entrées' : 'Total Sorties'}
      />

      <div className="mt-6 space-y-2 px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-headline font-semibold">Catégories</h3>
          {hiddenCategories.size > 0 && (
            <button
              onClick={() => setHiddenCategories(new Set())}
              className="text-xs font-medium text-gold/70 hover:text-gold transition-colors"
            >
              Afficher tout ({hiddenCategories.size} masquée{hiddenCategories.size > 1 ? 's' : ''})
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-separator border-t border-separator">
        {categoryData.items.map((item) => (
          <button
            key={item.name}
            onClick={() => setDrillDownCategory(item.name)}
            className="w-full text-left"
          >
            <MCategoryRow
              name={item.name}
              amount={item.amount}
              percentage={item.percentage}
              onToggleHide={toggleHideCategory}
              isHidden={false}
            />
          </button>
        ))}

        {categoryData.items.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-body text-label-tertiary">Aucune opération en {mode}</p>
          </div>
        )}
      </div>
    </div>
  );
};
