# Fix Budget Income Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure all inflows (like CAF) are correctly counted in the global "Income" KPI, even if their category is marked as an "Expense".

**Architecture:** Refactor the aggregation logic in `BankinBudgetsContainer.tsx` to calculate global totals (Income/Expense/Net) directly from individual transaction amounts instead of relying on the category's classification.

**Tech Stack:** React (TypeScript), Framer Motion, Lucide icons.

---

### Task 1: Refactor Aggregation Logic in BankinBudgetsContainer.tsx

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

- [ ] **Step 1: Move global total accumulation out of category-conditional blocks**

Modify the loop that iterates over `allCategoryNames`.

```typescript
// BEFORE
allCategoryNames.forEach((catName) => {
  // ...
  if (inflow > 0 || isBudgetDefinedAsIncome) {
    incomeCategories.push({ ... });
    totalReceived += inflow; // <--- BUG: depends on classification
  }
  if (outflow < 0 || (!isBudgetDefinedAsIncome && budgetMontant > 0)) {
    expenseCategories.push({ ... });
    totalSpent += Math.abs(outflow); // <--- BUG: depends on classification
  }
});

// AFTER
allCategoryNames.forEach((catName) => {
  const catTx = monthTx.filter((tx) => (tx.categorie || 'Non catégorisé') === catName);

  // 1. Agnostic Global Totals
  const catInflow = catTx.reduce((acc, tx) => acc + (Number(tx.montant) > 0 ? Number(tx.montant) : 0), 0);
  const catOutflow = catTx.reduce((acc, tx) => acc + (Number(tx.montant) < 0 ? Number(tx.montant) : 0), 0);

  totalReceived += catInflow;
  totalSpent += Math.abs(catOutflow);

  // 2. Display classification (remains the same for UI stability)
  const budgetObj = activeBudgets.find((b) => b.categorie === catName);
  const isBudgetDefinedAsIncome = isBudgetIncome(catName, budgetObj);
  // ... rest of the logic for incomeCategories/expenseCategories .push
});
```

- [ ] **Step 2: Remove redundant total accumulation inside conditional blocks**

Ensure `totalReceived += inflow` and `totalSpent += Math.abs(outflow)` are removed from the `if (inflow > 0 || ...)` and `if (outflow < 0 || ...)` blocks to avoid double counting.

- [ ] **Step 3: Verify math consistency**

Check that `netBalance = totalReceived - totalSpent` still holds and that `totalChartData` (which is already based on net amounts) is consistent with the new KPIs.

- [ ] **Step 4: Commit changes**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "fix(budget): calculate global income/expense agnostic of category classification"
```

### Task 2: Manual Verification

- [ ] **Step 1: Check CAF category**
      Verify that "CAF" entries now increase the global "Encaissé" total even if CAF is listed under "Expenses".

- [ ] **Step 2: Check refunds**
      Verify that a refund (e.g., in "Shopping") increases "Encaissé" instead of only reducing "Spent" in the top-level KPIs.
