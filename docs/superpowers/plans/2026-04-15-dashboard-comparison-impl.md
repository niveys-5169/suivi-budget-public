# Dashboard Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a React-based comparison tool for the dashboard to compare two months of financial data.

**Architecture:**

- **Hook Update:** Expose raw transactions from `useDashboard`.
- **New Component:** `DashboardComparison.tsx` handles independent filtering for two selected months.
- **Calculations:** Sums for Recettes, Dépenses, and Solde per month, plus Delta calculation.

**Tech Stack:** React, TypeScript, Intl.NumberFormat.

---

### Task 1: Expose raw transactions in useDashboard

**Files:**

- Modify: `public/src/hooks/useDashboard.tsx`

- [ ] **Step 1: Update the return object of useDashboard**
  - Add `transactions` to the returned object.

```typescript
return {
  period,
  setPeriod,
  monthKey,
  setMonthKey,
  customRange,
  setCustomRange,
  selectedCategories,
  setSelectedCategories,
  allCategories,
  filteredTransactions: dashboardFilteredTransactions,
  transactions, // Add this
  stats,
  ravConfig,
  shiftMonth,
};
```

- [ ] **Step 2: Commit hook change**
  ```bash
  git add public/src/hooks/useDashboard.tsx
  git commit -m "feat: expose raw transactions in useDashboard hook"
  ```

### Task 2: Create DashboardComparison Component

**Files:**

- Create: `public/src/components/DashboardComparison.tsx`

- [ ] **Step 1: Implement the component with state for two months**
  - Initial states for `monthA` (previous month) and `monthB` (current month).
  - Helper function to calculate KPIs for a given month and set of transactions.

```typescript
import React, { useState, useMemo } from 'react';
import { Transaction } from '../hooks/useTransactions';
import { fmt } from '../utils/format';

interface DashboardComparisonProps {
  transactions: Transaction[];
  selectedCategories: Set<string>;
}

export const DashboardComparison: React.FC<DashboardComparisonProps> = ({ transactions, selectedCategories }) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const [monthA, setMonthA] = useState(lastMonth);
  const [monthB, setMonthB] = useState(currentMonth);

  const getMonthStats = (mKey: string) => {
    const filtered = transactions.filter(t => {
      if (!t.pointe) return false;
      const cat = t.categorie || 'Non catégorisé';
      if (selectedCategories.size > 0 && !selectedCategories.has(cat)) return false;
      const assignedMonth = (t.moisAffectation || t.date || '').slice(0, 7);
      return assignedMonth === mKey;
    });

    const dep = filtered.filter(t => t.montant < 0).reduce((s, t) => s + t.montant, 0);
    const rec = filtered.filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0);
    return { dep, rec, solde: dep + rec };
  };

  const statsA = useMemo(() => getMonthStats(monthA), [monthA, transactions, selectedCategories]);
  const statsB = useMemo(() => getMonthStats(monthB), [monthB, transactions, selectedCategories]);

  const delta = {
    dep: statsB.dep - statsA.dep,
    rec: statsB.rec - statsA.rec,
    solde: statsB.solde - statsA.solde
  };

  const renderDelta = (val: number) => {
    const color = val >= 0 ? 'var(--green)' : 'var(--red)';
    const prefix = val >= 0 ? '+' : '';
    return <span style={{ color, fontWeight: 'bold' }}>{prefix}{fmt(val)}</span>;
  };

  // ... (Full implementation with JSX and styles) ...
}
```

- [ ] **Step 2: Commit component**
  ```bash
  git add public/src/components/DashboardComparison.tsx
  git commit -m "feat: add DashboardComparison component"
  ```

### Task 3: Integrate in DashboardSection

**Files:**

- Modify: `public/src/components/DashboardSection.tsx`

- [ ] **Step 1: Import and add the component to the render tree**
  - Pass `transactions` and `selectedCategories` as props.

- [ ] **Step 2: Commit integration**
  ```bash
  git add public/src/components/DashboardSection.tsx
  git commit -m "feat: integrate DashboardComparison in DashboardSection"
  ```
