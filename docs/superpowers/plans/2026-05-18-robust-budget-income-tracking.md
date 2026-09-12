# Robust Budget Income Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure 100% accurate global income/expense KPIs by calculating them directly from filtered transactions, decoupled from UI grouping logic, while optimizing performance through single-pass grouping.

**Architecture:**

1. Pre-calculate global `totalReceived` and `totalSpent` from `monthTx` (filtered for system categories) before any category-specific logic.
2. Group transactions by category name in a single pass to avoid repeated filtering.
3. Use the grouped data to populate `incomeCategories` and `expenseCategories`.

**Tech Stack:** React (TypeScript), Framer Motion, Lucide icons.

---

### Task 1: Refactor Aggregation Logic in BankinBudgetsContainer.tsx

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

- [ ] **Step 1: Define Transaction Grouping and Pre-calculate Global Totals**

Modify the `budgetData` useMemo to calculate totals first and group transactions.

```typescript
// ... after calculating monthTx and activeBudgets ...

const SYSTEM_CATEGORIES = new Set([
  'Virements internes',
  'Virement interne',
  'Epargne',
  'Retrait Epargne',
  'Prêt',
]);

// 1. Group transactions and calculate global totals in a single pass
const txByCategory: Record<string, any[]> = {};
let totalReceived = 0;
let totalSpent = 0;

monthTx.forEach((tx) => {
  const catName = tx.categorie || 'Non catégorisé';
  if (SYSTEM_CATEGORIES.has(catName)) return;

  if (!txByCategory[catName]) txByCategory[catName] = [];
  txByCategory[catName].push(tx);

  const amount = Number(tx.montant) || 0;
  if (amount > 0) totalReceived += amount;
  else if (amount < 0) totalSpent += Math.abs(amount);
});

// 2. Identify all relevant categories (active budgets + categories with transactions)
const allCategoryNames = new Set([
  ...activeBudgets.map((b) => b.categorie),
  ...Object.keys(txByCategory),
]);

const incomeCategories: any[] = [];
const expenseCategories: any[] = [];
let totalIncomeBudget = 0;
let totalExpenseBudget = 0;
```

- [ ] **Step 2: Update Category Loop to use Grouped Data**

Replace the existing `allCategoryNames.forEach` loop with one that uses `txByCategory`.

```typescript
allCategoryNames.forEach((catName) => {
  const catTx = txByCategory[catName] || [];

  const inflow = catTx.reduce(
    (acc, tx) => acc + (Number(tx.montant) > 0 ? Number(tx.montant) : 0),
    0,
  );
  const outflow = catTx.reduce(
    (acc, tx) => acc + (Number(tx.montant) < 0 ? Number(tx.montant) : 0),
    0,
  );

  // (totalReceived and totalSpent are already calculated above)

  const budgetObj = activeBudgets.find((b) => b.categorie === catName);
  const budgetMontant = budgetObj ? budgetObj.montant : 0;
  const isBudgetDefinedAsIncome = isBudgetIncome(catName, budgetObj);
  const netAmount = inflow + outflow;

  // ... rest of the logic (mappedTransactions, generateSparkline, etc.) remains identical ...
  // --- SECTION REVENUS ---
  if (inflow > 0 || isBudgetDefinedAsIncome) {
    incomeCategories.push({
      id: catName,
      spent: inflow,
      budget: isBudgetDefinedAsIncome ? budgetMontant : 0,
      sparklineData: generateSparkline(true),
      color: getCategoryMeta(catName).color,
      transactions: catTx.sort((a, b) => b.date.localeCompare(a.date)).map(mapBankinToInternal),
      isIncome: true,
    });
    if (isBudgetDefinedAsIncome) totalIncomeBudget += budgetMontant;
  }

  // --- SECTION DÉPENSES ---
  if (outflow < 0 || (!isBudgetDefinedAsIncome && budgetMontant > 0)) {
    const netSpent = Math.max(0, -netAmount);
    expenseCategories.push({
      id: catName,
      spent: netSpent,
      budget: !isBudgetDefinedAsIncome ? budgetMontant : 0,
      sparklineData: generateSparkline(false),
      color: getCategoryMeta(catName).color,
      transactions: catTx.sort((a, b) => b.date.localeCompare(a.date)).map(mapBankinToInternal),
      isIncome: false,
    });
    if (!isBudgetDefinedAsIncome) totalExpenseBudget += budgetMontant;
  }
});
```

- [ ] **Step 3: Commit changes to branch**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "fix(budget): optimize and robustify global income/expense calculation"
```

### Task 2: Verification

- [ ] **Step 1: Manual Check of CAF**
      Verify that CAF (outflow=0, inflow=500, classified as Expense) appears correctly in Income list and adds to global "Encaissé".

- [ ] **Step 2: Manual Check of Refunds**
      Verify that a -100 + 20 refund in "Shopping" results in +20 in Income KPI and -100 in Expense KPI, while showing 80 Net Spent in the row.
