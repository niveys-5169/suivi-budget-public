# Dashboard Analyse Discrepancies & UI Fixes Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align "Analyse" tab account count and budget total with reality and improve the drill-down UI transition.

**Architecture:**

1. Filter transactions by month before counting accounts in `AnalyseSection`.
2. Integrate `budgetCalculationScope` from `AppStateContext` to filter the budget sum in `AnalyseSection`.
3. Replace the side-slide transition in `AnalyseSlidePanel` with a more elegant "Bottom Sheet" or "Fade & Scale" animation.

**Tech Stack:** React, TypeScript, Framer Motion, Lucide Icons.

---

### Task 1: Fix Account Count Mismatch

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`

**Step 1: Update accountCount calculation**
Filter the transactions by `monthKey` before calculating the size of the unique accounts set.

```tsx
const accountCount = useMemo(() => {
  const monthTx = transactions.filter((tx) => {
    const txMonth = (tx as any).moisAffectation || tx.date?.slice(0, 7);
    return txMonth === monthKey;
  });
  return new Set(monthTx.map((tx) => (tx as any).compte).filter(Boolean)).size;
}, [transactions, monthKey]);
```

**Step 2: Verify fix**
(Manual verification as it's a UI discrepancy based on data)

- Navigate to Analyse tab.
- Check if account count matches the list shown when clicking.

**Step 3: Commit**

```bash
git add public/src/components/analyse/AnalyseSection.tsx
git commit -m "fix(analyse): filter account count by current month"
```

---

### Task 2: Fix Budget Total Mismatch

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`

**Step 1: Import useAppState and update totalBudget calculation**
Use `budgetCalculationScope` to filter categories included in the budget total.

```tsx
// ... imports
import { useAppState } from '../../context/AppStateContext';

// ... in AnalyseSection
const { budgetCalculationScope } = useAppState();

const totalBudget = useMemo(() => {
  return budgets
    .filter((b) => {
      const isActive = b.actif !== false;
      const isCalculated =
        budgetCalculationScope.length === 0 ||
        budgetCalculationScope.includes(b.id) ||
        budgetCalculationScope.includes(b.categorie);
      return isActive && isCalculated;
    })
    .reduce((s: number, b: any) => s + (b.montant || 0), 0);
}, [budgets, budgetCalculationScope]);
```

**Step 2: Verify fix**

- Navigate to Analyse tab.
- Compare budget total with the one shown in Budgets page. They should now match.

**Step 3: Commit**

```bash
git add public/src/components/analyse/AnalyseSection.tsx
git commit -m "fix(analyse): use budget calculation scope for total budget"
```

---

### Task 3: Improve UI Transition for Drill-downs

**Files:**

- Modify: `public/src/components/analyse/AnalyseSlidePanel.tsx`

**Step 1: Change animation from side-slide to fade-scale or bottom-slide**
Update the `motion.div` parameters for a smoother feel.

```tsx
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[90] bg-ink-deep overflow-y-auto"
    >
```

**Step 2: Verify UI**

- Click on a category or the account link.
- Observe the new animation. It should feel more "Premium" and less "ugly".

**Step 3: Commit**

```bash
git add public/src/components/analyse/AnalyseSlidePanel.tsx
git commit -m "ui(analyse): improve drill-down transition animation"
```
