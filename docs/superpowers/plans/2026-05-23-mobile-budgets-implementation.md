# Mobile Budgets Screen Implementation Plan (Lot 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a mobile-optimized Budgets screen with monthly/annual toggle, net balance hero, spending mastery bar, and a grid of budget cards with minimal progress indicators.

**Architecture:** Create `BudgetsScreen` in `public/src/mobile/screens/`. Port the aggregation logic from `BankinBudgetsContainer.tsx`. Use new mobile-specific components in `public/src/mobile/components/`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion, React-Intl.

---

### Task 1: Create MBudgetHero and MMasteryBar

**Files:**

- Create: `public/src/mobile/components/MBudgetHero.tsx`
- Create: `public/src/mobile/components/MMasteryBar.tsx`

- [ ] **Step 1: Implement `MBudgetHero`**

```tsx
import React from 'react';
import { FormattedNumber } from 'react-intl';
import { motion } from 'framer-motion';

interface MBudgetHeroProps {
  netBalance: number;
  label: string;
}

export const MBudgetHero: React.FC<MBudgetHeroProps> = ({ netBalance, label }) => {
  const isPositive = netBalance >= 0;

  return (
    <section className="px-4 py-6 flex flex-col items-center justify-center text-center">
      <span className="text-m-label font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">
        {label}
      </span>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-m-hero font-bold tracking-tight h-[32px] flex items-center tabular-nums
          ${isPositive ? 'text-gold' : 'text-ruby'}`}
      >
        <FormattedNumber
          value={netBalance}
          style="currency"
          currency="EUR"
          signDisplay="exceptZero"
        />
      </motion.h2>
    </section>
  );
};
```

- [ ] **Step 2: Implement `MMasteryBar`**

```tsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface MMasteryBarProps {
  progress: number;
  viewMode: 'monthly' | 'annual';
}

export const MMasteryBar: React.FC<MMasteryBarProps> = ({ progress, viewMode }) => {
  const isOver = progress > 100;

  const expectedProgress = useMemo(() => {
    const now = new Date();
    if (viewMode === 'monthly') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return (now.getDate() / daysInMonth) * 100;
    } else {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const totalDays = 365; // Simplified
      const daysPassed = Math.floor(
        (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
      );
      return (daysPassed / totalDays) * 100;
    }
  }, [viewMode]);

  return (
    <div className="px-4 pb-6">
      <div className="flex justify-between items-end mb-2">
        <span className="text-m-label font-bold text-zinc-500 uppercase tracking-[0.2em]">
          Maîtrise des dépenses
        </span>
        <span className={`text-m-caption font-bold ${isOver ? 'text-ruby' : 'text-zinc-400'}`}>
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-glass rounded-full overflow-hidden relative border border-white/5">
        {/* Expected progress line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
          style={{ left: `${expectedProgress}%` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${isOver ? 'bg-ruby shadow-[0_0_10px_rgba(185,28,28,0.3)]' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/components/MBudgetHero.tsx public/src/mobile/components/MMasteryBar.tsx
git commit -m "feat(mobile): add BudgetHero and MasteryBar components"
```

---

### Task 2: Implement MBudgetMiniCard and MBudgetGrid

**Files:**

- Create: `public/src/mobile/components/MBudgetMiniCard.tsx`
- Create: `public/src/mobile/components/MBudgetGrid.tsx`

- [ ] **Step 1: Implement `MBudgetMiniCard`**

```tsx
import React from 'react';
import { FormattedNumber } from 'react-intl';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';

interface MBudgetMiniCardProps {
  name: string;
  spent: number;
  budget: number;
  isIncome: boolean;
  onClick: () => void;
}

export const MBudgetMiniCard: React.FC<MBudgetMiniCardProps> = ({
  name,
  spent,
  budget,
  isIncome,
  onClick,
}) => {
  const meta = getCategoryMeta(name);
  const isOver = !isIncome && budget > 0 && spent > budget;
  const progress = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <button
      onClick={onClick}
      className="bg-glass border border-glass-border rounded-m-card p-3 flex flex-col gap-2 text-left active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <div
          className="w-6 h-6 rounded-control flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
        >
          <CategoryIcon icon={meta.icon} size={12} />
        </div>
        <span className="text-m-label font-bold text-zinc-500 uppercase truncate">{name}</span>
      </div>

      <div className="flex flex-col">
        <p className={`text-m-title font-bold tabular-nums ${isOver ? 'text-ruby' : 'text-white'}`}>
          <FormattedNumber
            value={spent}
            style="currency"
            currency="EUR"
            maximumFractionDigits={0}
          />
        </p>
        {budget > 0 && (
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
            Sur{' '}
            <FormattedNumber
              value={budget}
              style="currency"
              currency="EUR"
              maximumFractionDigits={0}
            />
          </p>
        )}
      </div>

      {budget > 0 && (
        <div className="h-[3px] w-full bg-white/5 rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: isOver ? '#EF4444' : meta.color,
            }}
          />
        </div>
      )}
    </button>
  );
};
```

- [ ] **Step 2: Implement `MBudgetGrid`**

```tsx
import React from 'react';
import { MBudgetMiniCard } from './MBudgetMiniCard';

interface MBudgetGridProps {
  title: string;
  color: string;
  categories: any[];
  onCategoryClick: (id: string) => void;
}

export const MBudgetGrid: React.FC<MBudgetGridProps> = ({
  title,
  color,
  categories,
  onCategoryClick,
}) => {
  if (categories.length === 0) return null;

  return (
    <div className="px-4 space-y-3 mb-8">
      <h3 className="text-m-label font-black uppercase tracking-[0.2em]" style={{ color }}>
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <MBudgetMiniCard
            key={cat.id}
            name={cat.nom}
            spent={cat.depense}
            budget={cat.montant}
            isIncome={cat.isIncome}
            onClick={() => onCategoryClick(cat.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/components/MBudgetMiniCard.tsx public/src/mobile/components/MBudgetGrid.tsx
git commit -m "feat(mobile): add BudgetMiniCard and BudgetGrid components"
```

---

### Task 3: Implement BudgetsScreen and Routing

**Files:**

- Create: `public/src/mobile/screens/BudgetsScreen.tsx`
- Modify: `public/src/MobileApp.tsx`

- [ ] **Step 1: Implement `BudgetsScreen`**
      Port the logic from `BankinBudgetsContainer.tsx` (aggregation, totalSpent, totalReceived, etc.) into the mobile screen. Use `useBudget` and `useTransactions`.

```tsx
import React, { useMemo, useState } from 'react';
import { MScreenHeader } from '../components/MScreenHeader';
import { MMonthNavigator } from '../components/MMonthNavigator';
import { MSegmentedControl } from '../components/MSegmentedControl';
import { MBudgetHero } from '../components/MBudgetHero';
import { MMasteryBar } from '../components/MMasteryBar';
import { MBudgetGrid } from '../components/MBudgetGrid';
import { useBudget } from '../../hooks/useBudget';
import { useTransactions } from '../../hooks/useTransactions';
import { CategoryDetail } from '../../components/budgets-v2/bankin/BankinBudgetsContainer';

export const BudgetsScreen: React.FC = () => {
  const { budgets, monthKey, setMonthKey, viewMode, setViewMode } = useBudget();
  const { transactions } = useTransactions();

  // Logic ported from BankinBudgetsContainer.tsx
  const budgetData = useMemo(() => {
    const year = monthKey.split('-')[0];
    const monthTx = transactions.filter((tx) => {
      const txMonth = tx.moisAffectation || (tx.date ? tx.date.slice(0, 7) : '');
      return viewMode === 'monthly'
        ? txMonth === monthKey
        : txMonth.startsWith(year) && txMonth <= monthKey;
    });

    const activeBudgets = budgets.filter((b) => b.actif !== false);
    const txByCategory: Record<string, any[]> = {};
    let totalReceived = 0;
    let totalSpent = 0;

    monthTx.forEach((tx) => {
      const catName = tx.categorie || 'Non catégorisé';
      if (!txByCategory[catName]) txByCategory[catName] = [];
      txByCategory[catName].push(tx);
      const amount = tx.montant || 0;
      if (amount > 0) totalReceived += amount;
      else if (amount < 0) totalSpent += Math.abs(amount);
    });

    const allCategoryNames = new Set([
      ...activeBudgets.map((b) => b.categorie || ''),
      ...Object.keys(txByCategory),
    ]);
    const incomeCategories: CategoryDetail[] = [];
    const expenseCategories: CategoryDetail[] = [];
    let totalExpenseBudget = 0;

    allCategoryNames.forEach((catName) => {
      if (!catName) return;
      const catTx = txByCategory[catName] || [];
      const inflow = catTx.reduce((acc, tx) => acc + (tx.montant > 0 ? tx.montant : 0), 0);
      const outflow = catTx.reduce((acc, tx) => acc + (tx.montant < 0 ? tx.montant : 0), 0);
      const budgetObj = activeBudgets.find((b) => b.categorie === catName);
      const budgetMontant = budgetObj ? budgetObj.montant : 0;
      const isIncome =
        budgetObj?.isIncome || budgetObj?.type === 'revenu' || inflow > Math.abs(outflow);

      if (isIncome || inflow > 0) {
        incomeCategories.push({
          id: catName,
          nom: catName,
          depense: inflow,
          montant: budgetMontant,
          isIncome: true,
          transactions: [],
          sparklineData: [],
        });
      }
      if (!isIncome || outflow < 0) {
        const netSpent = Math.max(0, -(inflow + outflow));
        expenseCategories.push({
          id: catName,
          nom: catName,
          depense: netSpent,
          montant: isIncome ? 0 : budgetMontant,
          isIncome: false,
          transactions: [],
          sparklineData: [],
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
    };
  }, [budgets, transactions, monthKey, viewMode]);

  const masteryProgress =
    budgetData.totalExpenseBudget > 0
      ? (budgetData.totalSpent / budgetData.totalExpenseBudget) * 100
      : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-12">
      <MScreenHeader title="Budgets" />

      <div className="px-4 py-2">
        <div className="flex p-1 bg-ink-100/50 border border-glass-border rounded-xl">
          <button
            onClick={() => setViewMode('monthly')}
            className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all
              ${viewMode === 'monthly' ? 'bg-gold text-ink' : 'text-zinc-500'}`}
          >
            Mois
          </button>
          <button
            onClick={() => setViewMode('annual')}
            className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all
              ${viewMode === 'annual' ? 'bg-gold text-ink' : 'text-zinc-500'}`}
          >
            Année
          </button>
        </div>
      </div>

      <MMonthNavigator monthKey={monthKey} onChange={setMonthKey} />

      <MBudgetHero
        netBalance={budgetData.netBalance}
        label={`Solde net ${viewMode === 'monthly' ? 'du mois' : 'YTD'}`}
      />

      <MMasteryBar progress={masteryProgress} viewMode={viewMode} />

      <MBudgetGrid
        title="Revenus & Rentrées"
        color="#10B981"
        categories={budgetData.incomeCategories}
        onCategoryClick={(id) => {
          /* Lot futur: Detail */
        }}
      />

      <MBudgetGrid
        title="Dépenses & Budgets"
        color="#D4AF37"
        categories={budgetData.expenseCategories}
        onCategoryClick={(id) => {
          /* Lot futur: Detail */
        }}
      />
    </div>
  );
};
```

- [ ] **Step 2: Update `MobileApp.tsx` routes**
      Modify `public/src/MobileApp.tsx`:

```tsx
import { BudgetsScreen } from './mobile/screens/BudgetsScreen';

// ... in Routes ...
<Route path="/budgets/*" element={<BudgetsScreen />} />;
```

- [ ] **Step 3: Verify build**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/screens/BudgetsScreen.tsx public/src/MobileApp.tsx
git commit -m "feat(mobile): implement BudgetsScreen and routing"
```
