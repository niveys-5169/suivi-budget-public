# Annual Budget and YTD Vision Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a dual-mode budget view (Monthly vs Annual) in the Bankin-style dashboard, allowing users to see Monthly Budget vs Monthly Expenses and Annual Budget vs Year-to-Date (YTD) expenses.

**Architecture:** Use `viewMode` from `BudgetContext` to toggle between modes. Update `BankinBudgetsContainer` to aggregate transactions YTD when in 'annual' mode. Update `BankinBudgetMain` UI to reflect the current mode.

**Tech Stack:** React, TypeScript, Framer Motion, Lucide Icons.

---

### Task 1: Add View Mode Toggle to BankinBudgetsContainer

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

**Step 1: Update imports and add view mode toggle**

```tsx
// Inside BankinBudgetsContainer component:
const { budgets, monthKey, setMonthKey, viewMode, setViewMode } = useBudget();
// ...

// Update the header actions to include a Mois/Année toggle
return (
  <div className="premium-container min-h-screen bg-ink-deep pb-24">
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 md:px-6 pt-6">
      {/* Toggle View Mode */}
      <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex items-center">
        <button
          onClick={() => setViewMode('monthly')}
          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'monthly' ? 'bg-gold text-ink' : 'text-platinum/40 hover:text-platinum'
          }`}
        >
          Mois
        </button>
        <button
          onClick={() => setViewMode('annual')}
          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            viewMode === 'annual' ? 'bg-gold text-ink' : 'text-platinum/40 hover:text-platinum'
          }`}
        >
          Année
        </button>
      </div>

      <div className="flex items-center gap-2">{/* RAV and Manager buttons ... */}</div>
    </div>
    {/* ... */}
  </div>
);
```

**Step 2: Commit**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "feat(budget): add monthly/annual toggle to BankinBudgetsContainer"
```

---

### Task 2: Implement YTD Transaction Aggregation

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

**Step 1: Update budgetData calculation to handle annual/YTD**

```tsx
// Inside BankinBudgetsContainer budgetData useMemo:
const budgetData = useMemo(() => {
  // 1. Filter transactions based on viewMode
  const year = monthKey.split('-')[0];
  const monthTx = transactions.filter((tx) => {
    const txMonth = tx.moisAffectation || tx.date.slice(0, 7);
    if (viewMode === 'monthly') {
      return txMonth === monthKey;
    } else {
      // Annual: All transactions from the start of the year up to the current monthKey
      return txMonth.startsWith(year) && txMonth <= monthKey;
    }
  });

  // ... rest of the logic remains largely the same as budgets already have the correct 'montant' from context
  // ...
}, [budgets, transactions, monthKey, viewMode]);
```

**Step 2: Update labels in BankinBudgetsContainer if necessary**

**Step 3: Commit**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "feat(budget): implement YTD transaction filtering in annual mode"
```

---

### Task 3: Update BankinBudgetMain to reflect View Mode

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetMain.tsx`

**Step 1: Pass viewMode prop to BankinBudgetMain**

Update `BankinBudgetsContainer.tsx` to pass `viewMode` to `BankinBudgetMain`.

**Step 2: Update BankinBudgetMain to display dynamic labels**

```tsx
interface Props {
  // ...
  viewMode: 'monthly' | 'annual';
}

export const BankinBudgetMain: React.FC<Props> = ({
  // ...
  viewMode,
}) => {
  const labelSpent = viewMode === 'monthly' ? 'Dépensé ce mois-ci' : 'Dépensé cette année (YTD)';
  const labelBudget = viewMode === 'monthly' ? 'Budget total' : 'Budget annuel';
  const labelRemaining = viewMode === 'monthly' ? 'Restant' : 'Reliquat annuel';

  // Use these labels in the JSX
  // ...
};
```

**Step 3: Commit**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetMain.tsx
git commit -m "feat(budget): update BankinBudgetMain labels based on viewMode"
```

---

### Task 4: Fix Chart Data for Annual View

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

**Step 1: Aggregrate chart data by month instead of day when in annual mode**

```tsx
// Inside budgetData useMemo:
let chartData;
if (viewMode === 'monthly') {
  // Current day-by-day logic
  // ...
} else {
  // Month-by-month logic for the year
  const monthMap: Record<number, number> = {};
  monthTx
    .filter((tx) => tx.montant < 0)
    .forEach((tx) => {
      const m = parseInt((tx.moisAffectation || tx.date).slice(5, 7));
      monthMap[m] = (monthMap[m] || 0) + Math.abs(tx.montant);
    });

  let totalCumul = 0;
  chartData = Array.from({ length: 12 }, (_, i) => {
    totalCumul += monthMap[i + 1] || 0;
    return { day: i + 1, amount: totalCumul, label: `Mois ${i + 1}` };
  }).filter((d) => d.day <= parseInt(monthKey.slice(5, 7)) || d.amount > 0);
}
```

**Step 2: Update BankinBudgetMain to handle the label in Tooltip**

**Step 3: Commit**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "feat(budget): aggregate chart data by month in annual view"
```
