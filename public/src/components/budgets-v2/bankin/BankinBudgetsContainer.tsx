import React, { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Settings2, Wallet } from 'lucide-react';
import { deleteField } from 'firebase/firestore';
import { useBudget } from '../../../hooks/useBudget';
import { useBudgetExclusions } from '../../../hooks/useBudgetExclusions';
import { useTransactions } from '../../../hooks/useTransactions';
import { useBalances } from '../../../hooks/useBalances';
import { updateBudget } from '../../../api/budgets';
import { BankinBudgetMain } from './BankinBudgetMain';
import { BankinBudgetCategoryDetail } from './BankinBudgetCategoryDetail';
import { BudgetManagerPanel } from '../BudgetManagerPanel';
import { RAVEditor } from '../RAVEditor';
import { TransactionFormModal } from '../../TransactionFormModal';
import { getCategoryMeta } from '../../../constants/categoryMetadata';
import { categoryKey, preferDisplayLabel } from '../../../utils/budgetHelpers';
import { budgetDocKey } from '../../../utils/budgetKey';
import { Transaction, BudgetBase, BudgetConsumption } from '../../../types/banking.types';
import { hideLoader } from '../../../utils/loader';

export interface CategoryDetail extends Partial<BudgetConsumption> {
  id: string;
  nom: string;
  depense: number;
  montant: number;
  transactions: Transaction[];
  sparklineData: { day: number; amount: number }[];
  isIncome: boolean;
  storedIsIncome?: boolean; // drapeau brut Firestore (undefined = Auto, true = Entrée, false = Sortie)
  color?: string;
}

type ViewState = { type: 'main' } | { type: 'category'; categoryId: string };

export const BankinBudgetsContainer: React.FC = () => {
  const { budgets, monthKey, setMonthKey, viewMode, setViewMode } = useBudget();
  const { excluded } = useBudgetExclusions();
  const { transactions, togglePointe, saveTransaction, deleteTransaction } = useTransactions();
  const { balances } = useBalances();
  const [viewState, setViewState] = useState<ViewState>({ type: 'main' });
  const [showManager, setShowManager] = useState(false);
  const [showRavEditor, setShowRavEditor] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const txCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => (t.categorie || '').trim()).filter(Boolean));
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [transactions]);

  const accounts = useMemo(() => {
    return Array.from(new Set(balances.map((b) => b.compte)))
      .filter((c): c is string => Boolean(c))
      .sort();
  }, [balances]);

  // Cycle Auto → Entrée → Sortie → Auto pour une catégorie depuis la carte.
  const handleToggleSens = useCallback(
    async (catId: string, current: boolean | undefined) => {
      const budget = budgets.find((b) => categoryKey(b.categorie || '') === categoryKey(catId));
      const next = current === undefined ? true : current === true ? false : undefined;
      if (!budget) {
        // Pas de budget pour cette catégorie : on crée un doc inactif qui ne porte que le sens.
        if (next === undefined) return;
        await updateBudget(budgetDocKey(catId), {
          categorie: catId,
          nom: catId,
          montant: 0,
          actif: false,
          isIncome: next,
        });
        return;
      }
      const payload = next !== undefined ? { isIncome: next } : { isIncome: deleteField() };
      await updateBudget(budget.id || budgetDocKey(budget.categorie || ''), payload);
    },
    [budgets],
  );

  const incomeCats = useMemo<Set<string>>(() => {
    const cats = new Set<string>();

    // Auto-detect based on historical transactions
    const catStats: Record<string, { pos: number; neg: number }> = {};
    (transactions || []).forEach((t) => {
      const c = t.categorie;
      if (!c) return;
      if (!catStats[c]) catStats[c] = { pos: 0, neg: 0 };
      if ((t.montant || 0) > 0) catStats[c].pos++;
      else if ((t.montant || 0) < 0) catStats[c].neg++;
    });

    Object.entries(catStats).forEach(([c, stats]) => {
      if (stats.pos > 0 && stats.pos > stats.neg) {
        cats.add(c);
      }
    });
    return cats;
  }, [transactions]);

  const isBudgetIncome = React.useCallback(
    (catName: string, budgetObj?: BudgetBase): boolean =>
      budgetObj?.isIncome === true
        ? true
        : budgetObj?.isIncome === false
          ? false
          : budgetObj?.type === 'revenu' || incomeCats.has(catName),
    [incomeCats],
  );

  React.useEffect(() => {
    hideLoader();
  }, []);

  // Parsing du mois actuel
  const currentMonth = useMemo(() => {
    const [y = NaN, m = NaN] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [monthKey]);

  const handleMonthChange = (date: Date) => {
    const newKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setMonthKey(newKey);
  };

  // Calcul des données agrégées
  const budgetData = useMemo(() => {
    // 1. Filtrer les transactions selon le mode de vue (mensuel ou annuel/YTD)
    const year = monthKey.split('-')[0] ?? '';
    const monthTx = transactions.filter((tx) => {
      const txMonth = tx.moisAffectation || (tx.date ? tx.date.slice(0, 7) : '');
      if (viewMode === 'monthly') {
        return txMonth === monthKey;
      } else {
        // Annuel : toutes les transactions du début de l'année jusqu'au mois sélectionné (YTD)
        return txMonth.startsWith(year) && txMonth <= monthKey;
      }
    });

    // 2. Préparer les catégories
    const activeBudgets = budgets.filter((b) => b.actif !== false);

    // Catégories système à ne pas auto-inclure si elles n'ont pas de budget explicite
    const SYSTEM_CATEGORIES = new Set(excluded);

    // 1. Group transactions by CANONICAL category key (case/accents/whitespace/NFC-NFD)
    //    so graphie variants aggregate together instead of spawning a 0-budget ghost.
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

    // 2. Identify all relevant categories (active budgets + categories with transactions)
    const allCategoryKeys = new Set([
      ...activeBudgets.map((b) => categoryKey(b.categorie || '')),
      ...Object.keys(txByCategory),
    ]);

    const incomeCategories: CategoryDetail[] = [];
    const expenseCategories: CategoryDetail[] = [];

    let totalIncomeBudget = 0;
    let totalExpenseBudget = 0;

    allCategoryKeys.forEach((catKey) => {
      if (!catKey) return;
      const catName = keyToLabel[catKey] || catKey;
      const catTx = txByCategory[catKey] || [];

      const inflow = catTx.reduce(
        (acc, tx) => acc + ((tx.montant || 0) > 0 ? tx.montant || 0 : 0),
        0,
      );
      const outflow = catTx.reduce(
        (acc, tx) => acc + ((tx.montant || 0) < 0 ? tx.montant || 0 : 0),
        0,
      );

      const budgetObj = activeBudgets.find((b) => categoryKey(b.categorie || '') === catKey);
      const budgetMontant = budgetObj ? budgetObj.montant : 0;
      // Le sens choisi via la carte est lu même sur un budget inactif (doc « sens seul »).
      const storedIsIncome = (
        budgetObj ?? budgets.find((b) => categoryKey(b.categorie || '') === catKey)
      )?.isIncome;
      const isBudgetDefinedAsIncome =
        storedIsIncome !== undefined ? storedIsIncome : isBudgetIncome(catName, budgetObj);

      const netAmount = inflow + outflow;

      // Transactions directes sans mapping (déjà au bon format)
      const mappedTransactions = [...catTx].sort((a, b) => b.date.localeCompare(a.date));

      // Base Sparkline generation function
      const generateSparkline = (isForIncome: boolean) => {
        let sparklineData: { day: number; amount: number }[];
        if (viewMode === 'monthly') {
          const dayMap: Record<number, number> = {};
          catTx.forEach((tx) => {
            const day = new Date(tx.date).getDate();
            dayMap[day] = (dayMap[day] || 0) + (tx.montant || 0);
          });
          let cumul = 0;
          sparklineData = Array.from({ length: 31 }, (_, i) => {
            const dailyNet = dayMap[i + 1] || 0;
            cumul = isForIncome ? Math.max(0, cumul + dailyNet) : Math.max(0, cumul - dailyNet);
            return { day: i + 1, amount: cumul };
          }).filter((d) => d.day <= new Date().getDate() || d.amount > 0);
        } else {
          const monthMap: Record<number, number> = {};
          catTx.forEach((tx) => {
            const m = Number((tx.moisAffectation || tx.date).split('-')[1]);
            monthMap[m] = (monthMap[m] || 0) + (tx.montant || 0);
          });
          let cumul = 0;
          const targetMonth = Number(monthKey.split('-')[1]);
          sparklineData = Array.from({ length: targetMonth }, (_, i) => {
            const monthlyNet = monthMap[i + 1] || 0;
            cumul = isForIncome ? Math.max(0, cumul + monthlyNet) : Math.max(0, cumul - monthlyNet);
            return { day: i + 1, amount: cumul };
          });
        }
        return sparklineData;
      };

      const meta = getCategoryMeta(catName);

      // --- SECTION REVENUS ---
      // On l'ajoute si on a reçu de l'argent (>0) OU si c'est explicitement un budget de revenu
      if (isBudgetDefinedAsIncome || (inflow > 0 && !budgetObj && storedIsIncome === undefined)) {
        incomeCategories.push({
          id: catName,
          nom: catName,
          depense: inflow,
          montant: isBudgetDefinedAsIncome ? budgetMontant : 0,
          sparklineData: generateSparkline(true),
          color: meta.color,
          transactions: mappedTransactions,
          isIncome: true,
          storedIsIncome,
        });
        if (isBudgetDefinedAsIncome) totalIncomeBudget += budgetMontant;
      } else if (outflow < 0 || budgetMontant > 0 || storedIsIncome === false) {
        // --- SECTION DÉPENSES ---
        // Le montant "spent" affiché est le NET (Dépenses - Remboursements).
        // Pas de clamp : un excédent de remboursements affiche un solde positif (vert).
        const netSpent = -netAmount;
        expenseCategories.push({
          id: catName,
          nom: catName,
          depense: netSpent,
          montant: budgetMontant,
          sparklineData: generateSparkline(false),
          color: meta.color,
          transactions: mappedTransactions,
          isIncome: false,
          storedIsIncome,
        });
        totalExpenseBudget += budgetMontant;
      }
    });

    incomeCategories.sort((a, b) => b.depense - a.depense);
    expenseCategories.sort((a, b) => b.depense - a.depense);

    const netBalance = totalReceived - totalSpent;

    // 5. Chart data total (Basé sur le Net)
    let totalChartData: { day: number; amount: number }[];
    if (viewMode === 'monthly') {
      const totalDayMap: Record<number, number> = {};
      monthTx.forEach((tx) => {
        const day = new Date(tx.date).getDate();
        totalDayMap[day] = (totalDayMap[day] || 0) + (tx.montant || 0);
      });

      let totalCumul = 0;
      totalChartData = Array.from({ length: 31 }, (_, i) => {
        totalCumul += totalDayMap[i + 1] || 0;
        return { day: i + 1, amount: totalCumul };
      }).filter((d) => d.day <= new Date().getDate() || d.amount !== 0);
    } else {
      const totalMonthMap: Record<number, number> = {};
      monthTx.forEach((tx) => {
        const m = Number((tx.moisAffectation || tx.date).split('-')[1]);
        totalMonthMap[m] = (totalMonthMap[m] || 0) + (tx.montant || 0);
      });
      let totalCumul = 0;
      totalChartData = Array.from({ length: 12 }, (_, i) => {
        totalCumul += totalMonthMap[i + 1] || 0;
        return { day: i + 1, amount: totalCumul };
      }).filter((d) => d.day <= Number(monthKey.split('-')[1]) || d.amount !== 0);
    }

    return {
      incomeCategories,
      expenseCategories,
      totalReceived,
      totalSpent,
      totalIncomeBudget,
      totalExpenseBudget,
      netBalance,
      totalChartData,
    };
  }, [budgets, transactions, monthKey, viewMode, isBudgetIncome, excluded]);

  if (viewState.type === 'category') {
    const category = [...budgetData.incomeCategories, ...budgetData.expenseCategories].find(
      (c) => c.id === viewState.categoryId,
    );
    return (
      <>
        <BankinBudgetCategoryDetail
          category={category as BudgetConsumption}
          onBack={() => {
            setViewState({ type: 'main' });
            setEditingTransaction(null);
          }}
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
          onTogglePointe={togglePointe}
          onSaveTransaction={saveTransaction}
          onOpenTransaction={(txId) => {
            const tx = transactions.find((t) => t.id === txId);
            if (tx) setEditingTransaction(tx);
          }}
          viewMode={viewMode}
        />
        <TransactionFormModal
          isOpen={editingTransaction !== null}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          categories={txCategories}
          accounts={accounts}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div
        className="sticky top-0 z-sticky -mx-4 md:-mx-10 bg-bg/80 backdrop-blur-md border-b border-separator"
        style={{
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 md:px-10 py-4">
          {/* Toggle View Mode */}
          <div className="bg-surface p-1 rounded-xl border border-separator flex items-center">
            <button
              onClick={() => setViewMode('monthly')}
              aria-pressed={viewMode === 'monthly'}
              className={`px-4 py-2 rounded-lg text-caption font-semibold transition-all ${
                viewMode === 'monthly' ? 'bg-gold text-bg' : 'text-label/40 hover:text-label'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('annual')}
              aria-pressed={viewMode === 'annual'}
              className={`px-4 py-2 rounded-lg text-caption font-semibold transition-all ${
                viewMode === 'annual' ? 'bg-gold text-bg' : 'text-label/40 hover:text-label'
              }`}
            >
              Année
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowRavEditor((v) => !v);
                if (!showRavEditor) setShowManager(false);
              }}
              className={`px-4 h-10 rounded-xl text-caption font-semibold transition-all border flex items-center gap-2 ${
                showRavEditor
                  ? 'bg-gold text-bg border-gold shadow shadow-gold/20'
                  : 'bg-surface text-label/50 border-separator hover:text-white'
              }`}
            >
              <Wallet size={12} />
              Reste à vivre
            </button>
            <button
              onClick={() => {
                setShowManager((v) => !v);
                if (!showManager) setShowRavEditor(false);
              }}
              className={`px-4 h-10 rounded-xl text-caption font-semibold transition-all border flex items-center gap-2 ${
                showManager
                  ? 'bg-gold text-bg border-gold shadow shadow-gold/20'
                  : 'bg-surface text-label/50 border-separator hover:text-white'
              }`}
            >
              <Settings2 size={12} />
              Gérer les budgets
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showRavEditor && <RAVEditor monthKey={monthKey} onClose={() => setShowRavEditor(false)} />}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showManager && <BudgetManagerPanel onClose={() => setShowManager(false)} />}
      </AnimatePresence>

      <BankinBudgetMain
        netBalance={budgetData.netBalance}
        totalSpent={budgetData.totalSpent}
        totalReceived={budgetData.totalReceived}
        totalBudget={budgetData.totalExpenseBudget}
        totalIncomeBudget={budgetData.totalIncomeBudget}
        incomeCategories={budgetData.incomeCategories}
        expenseCategories={budgetData.expenseCategories}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        chartData={budgetData.totalChartData}
        onCategoryClick={(id) => setViewState({ type: 'category', categoryId: id })}
        onToggleSens={handleToggleSens}
        viewMode={viewMode}
      />
    </div>
  );
};
