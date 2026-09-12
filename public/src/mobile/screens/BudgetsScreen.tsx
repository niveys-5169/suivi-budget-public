import React, { useMemo, useState } from 'react';
import { CHART_COLORS } from '../../lib/colors';
import { Settings2, Target } from 'lucide-react';
import { deleteField } from 'firebase/firestore';
import { updateBudget } from '../../api/budgets';
import { budgetDocKey } from '../../utils/budgetKey';
import { getExpectedPaceProgress } from '../../utils/date';
import { MScreenHeader } from '../components/MScreenHeader';
import { MMonthNavigator } from '../components/MMonthNavigator';
import { MBudgetHero } from '../components/MBudgetHero';
import { MMasteryBar } from '../components/MMasteryBar';
import { MBudgetGrid } from '../components/MBudgetGrid';
import { EmptyState } from '../../components/shared/EmptyState';
import { MBudgetFormModal } from '../components/MBudgetFormModal';
import { MBudgetExclusionsModal } from '../components/MBudgetExclusionsModal';
import { MCategoryDrillDown } from '../components/MCategoryDrillDown';
import { TransactionFormModal } from '../../components/TransactionFormModal';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { categoryKey, preferDisplayLabel } from '../../utils/budgetHelpers';
import { useBudget } from '../../hooks/useBudget';
import { useBudgetExclusions } from '../../hooks/useBudgetExclusions';
import { useTransactions } from '../../hooks/useTransactions';
import { useBalances } from '../../hooks/useBalances';
import type { Transaction } from '../../types/banking.types';
import type { CategoryDetail } from '../../components/budgets-v2/bankin/BankinBudgetsContainer';

export const BudgetsScreen: React.FC = () => {
  const { budgets, monthKey, setMonthKey, viewMode, setViewMode } = useBudget();
  const { excluded, setExcluded } = useBudgetExclusions();
  const { transactions, saveTransaction, deleteTransaction } = useTransactions();
  const { balances } = useBalances();
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showExclusions, setShowExclusions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Logic ported from BankinBudgetsContainer.tsx
  const budgetData = useMemo(() => {
    const year = monthKey.split('-')[0] ?? '';
    const monthTx = transactions.filter((tx) => {
      const txMonth = tx.moisAffectation || (tx.date ? tx.date.slice(0, 7) : '');
      return viewMode === 'monthly'
        ? txMonth === monthKey
        : txMonth.startsWith(year) && txMonth <= monthKey;
    });

    const activeBudgets = budgets.filter((b) => b.actif !== false);
    const SYSTEM_CATEGORIES = new Set(excluded);

    // Bucket transactions by CANONICAL category key so graphie variants
    // (case/accents/whitespace/NFC-NFD) aggregate together instead of spawning a ghost.
    const txByCategory: Record<string, Transaction[]> = {};
    const keyToLabel: Record<string, string> = {};
    let totalReceived = 0;
    let totalSpent = 0;

    monthTx.forEach((tx) => {
      const rawCat = tx.categorie || 'Non catégorisé';
      if (SYSTEM_CATEGORIES.has(rawCat)) return;
      const key = categoryKey(rawCat);
      keyToLabel[key] = preferDisplayLabel(keyToLabel[key] || '', rawCat);
      if (!txByCategory[key]) txByCategory[key] = [];
      txByCategory[key].push(tx);
      const amount = tx.montant || 0;
      if (amount > 0) totalReceived += amount;
      else if (amount < 0) totalSpent += Math.abs(amount);
    });

    activeBudgets.forEach((b) => {
      const key = categoryKey(b.categorie || '');
      if (!key) return;
      keyToLabel[key] = preferDisplayLabel(keyToLabel[key] || '', b.categorie || '');
    });

    const allCategoryKeys = new Set([
      ...activeBudgets.map((b) => categoryKey(b.categorie || '')),
      ...Object.keys(txByCategory),
    ]);
    const incomeCategories: CategoryDetail[] = [];
    const expenseCategories: CategoryDetail[] = [];
    let totalExpenseBudget = 0;

    allCategoryKeys.forEach((catKey) => {
      if (!catKey) return;
      const catName = keyToLabel[catKey] || catKey;
      const catTx = txByCategory[catKey] || [];
      const inflow = catTx.reduce(
        (acc, tx) => acc + ((tx.montant ?? 0) > 0 ? (tx.montant ?? 0) : 0),
        0,
      );
      const outflow = catTx.reduce(
        (acc, tx) => acc + ((tx.montant ?? 0) < 0 ? (tx.montant ?? 0) : 0),
        0,
      );
      const budgetObj = activeBudgets.find((b) => categoryKey(b.categorie || '') === catKey);
      const budgetMontant = budgetObj ? budgetObj.montant : 0;
      // Tri-état : true/false force le sens ; absent → heuristiques en secours.
      const isIncome =
        budgetObj?.isIncome === true
          ? true
          : budgetObj?.isIncome === false
            ? false
            : Boolean(budgetObj?.type === 'revenu' || (inflow > 0 && inflow > Math.abs(outflow)));

      if (isIncome || (inflow > 0 && !budgetObj)) {
        incomeCategories.push({
          id: catName,
          nom: catName,
          depense: inflow,
          montant: isIncome ? budgetMontant : 0,
          isIncome: true,
          transactions: [],
          sparklineData: [],
          storedIsIncome: budgetObj?.isIncome,
        });
      }
      if (!isIncome || outflow < 0) {
        const netSpent = -(inflow + outflow);
        expenseCategories.push({
          id: catName,
          nom: catName,
          depense: netSpent,
          montant: isIncome ? 0 : budgetMontant,
          isIncome: false,
          transactions: [],
          sparklineData: [],
          storedIsIncome: budgetObj?.isIncome,
        });
        if (!isIncome) totalExpenseBudget += budgetMontant;
      }
    });

    return {
      incomeCategories: incomeCategories.sort((a, b) => b.depense - a.depense),
      expenseCategories: expenseCategories.sort((a, b) => b.depense - a.depense),
      totalSpent,
      totalReceived,
      totalExpenseBudget,
      netBalance: totalReceived - totalSpent,
      txByCategory,
    };
  }, [budgets, transactions, monthKey, viewMode, excluded]);

  const masteryProgress =
    budgetData.totalExpenseBudget > 0
      ? (budgetData.totalSpent / budgetData.totalExpenseBudget) * 100
      : 0;

  const expectedProgress = useMemo(
    () => getExpectedPaceProgress(viewMode === 'annual' ? 'annual' : 'monthly', monthKey),
    [viewMode, monthKey],
  );

  const categories = useMemo<string[]>(() => {
    const budgetCategories = budgets
      .filter((b) => b.actif !== false)
      .map((b) => b.categorie || '')
      .filter(Boolean);
    const txCategories = new Set(
      transactions.map((t) => t.categorie).filter((c): c is string => Boolean(c)),
    );
    return Array.from(new Set([...budgetCategories, ...txCategories])).sort();
  }, [budgets, transactions]);

  const accounts = useMemo<string[]>(() => {
    return Array.from(new Set(balances.map((b) => b.compte)))
      .filter((c): c is string => Boolean(c))
      .sort();
  }, [balances]);

  const getEditingBudgetData = () => {
    if (!editingCategory) return undefined;
    return budgets.find((b) => categoryKey(b.categorie || '') === categoryKey(editingCategory));
  };

  const handleToggleSens = async (catId: string, current: boolean | undefined) => {
    const budget = budgets.find((b) => categoryKey(b.categorie || '') === categoryKey(catId));
    if (!budget) return;
    const next = current === undefined ? true : current === true ? false : undefined;
    const payload = next !== undefined ? { isIncome: next } : { isIncome: deleteField() };
    await updateBudget(budget.id || budgetDocKey(budget.categorie || ''), payload);
  };

  const drillDown = useMemo(() => {
    if (!viewingCategory) return null;
    const categoryTx = budgetData.txByCategory[categoryKey(viewingCategory)] ?? [];
    const totalSpent = categoryTx.reduce((acc, tx) => acc + Math.abs(tx.montant || 0), 0);
    const color = getCategoryMeta(viewingCategory).color;
    const catDetail = [...budgetData.expenseCategories, ...budgetData.incomeCategories].find(
      (c) => c.id === viewingCategory,
    );
    const [py = NaN, pm = NaN] = monthKey.split('-').map(Number);
    const lastDay = String(new Date(py, pm, 0).getDate()).padStart(2, '0');
    const periodeDebut = viewMode === 'monthly' ? `${monthKey}-01` : `${py}-01-01`;
    const periodeFin = `${monthKey}-${lastDay}`;
    return { categoryTx, totalSpent, color, catDetail, periodeDebut, periodeFin };
  }, [viewingCategory, budgetData, monthKey, viewMode]);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-12">
      {viewingCategory && drillDown ? (
        <MCategoryDrillDown
          categoryName={viewingCategory}
          transactions={drillDown.categoryTx}
          color={drillDown.color}
          totalSpent={drillDown.totalSpent}
          budget={drillDown.catDetail?.montant ?? 0}
          periodeDebut={drillDown.periodeDebut}
          periodeFin={drillDown.periodeFin}
          onBack={() => {
            setViewingCategory(null);
            setSelectedTransaction(null);
          }}
          onTransactionClick={(tx) => setSelectedTransaction(tx)}
          onEditBudget={() => setEditingCategory(viewingCategory)}
        />
      ) : (
        <>
          <MScreenHeader
            title="Budgets"
            rightAction={
              <button
                onClick={() => setShowExclusions(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-label-secondary"
                aria-label="Catégories exclues des budgets"
              >
                <Settings2 size={18} />
              </button>
            }
          />

          <div className="px-4 py-2">
            <div className="flex p-1 bg-raised border border-separator rounded-xl">
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex-1 py-2 text-caption font-semibold rounded-lg transition-all
              ${viewMode === 'monthly' ? 'bg-gold text-bg' : 'text-label-tertiary'}`}
              >
                Mois
              </button>
              <button
                onClick={() => setViewMode('annual')}
                className={`flex-1 py-2 text-caption font-semibold rounded-lg transition-all
              ${viewMode === 'annual' ? 'bg-gold text-bg' : 'text-label-tertiary'}`}
              >
                Année
              </button>
            </div>
          </div>

          <MMonthNavigator monthKey={monthKey} onChange={setMonthKey} />

          <MBudgetHero
            netBalance={budgetData.netBalance}
            label={`Solde net ${viewMode === 'monthly' ? 'du mois' : 'YTD'}`}
            totalReceived={budgetData.totalReceived}
            totalSpent={budgetData.totalSpent}
          />

          <MMasteryBar
            progress={masteryProgress}
            viewMode={viewMode}
            totalBudget={budgetData.totalExpenseBudget}
            totalSpent={budgetData.totalSpent}
            expectedProgress={expectedProgress}
          />

          {budgetData.incomeCategories.length === 0 && budgetData.expenseCategories.length === 0 ? (
            <EmptyState
              icon={<Target size={28} />}
              title="Aucun budget"
              description="Aucune transaction ni enveloppe sur cette période."
            />
          ) : (
            <>
              <MBudgetGrid
                title="Revenus & Rentrées"
                color={CHART_COLORS.emerald}
                categories={budgetData.incomeCategories}
                onCategoryClick={(id) => setViewingCategory(id)}
                onToggleSens={handleToggleSens}
                expectedPct={expectedProgress}
              />

              <MBudgetGrid
                title="Dépenses & Budgets"
                color={CHART_COLORS.gold}
                categories={budgetData.expenseCategories}
                onCategoryClick={(id) => setViewingCategory(id)}
                onToggleSens={handleToggleSens}
                expectedPct={expectedProgress}
              />
            </>
          )}
        </>
      )}

      {editingCategory && (
        <MBudgetFormModal
          categoryName={editingCategory}
          currentBudget={getEditingBudgetData()}
          onClose={() => setEditingCategory(null)}
          onSave={() => setEditingCategory(null)}
        />
      )}

      {showExclusions && (
        <MBudgetExclusionsModal
          categories={categories}
          excluded={excluded}
          onClose={() => setShowExclusions(false)}
          onSave={(next) => {
            setExcluded(next);
            setShowExclusions(false);
          }}
        />
      )}

      <TransactionFormModal
        isOpen={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
        categories={categories as string[]}
        accounts={accounts as string[]}
      />
    </div>
  );
};
