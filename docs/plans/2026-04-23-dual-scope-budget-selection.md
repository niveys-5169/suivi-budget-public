# Dual-Scope Budget Calculation Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Distinguish between categories excluded from the total budget calculation and categories that are calculated but hidden from the detail view.

**Architecture:**

1. Update `AppStateContext.tsx` to include `budgetCalculationScope`.
2. Update `BudgetsPage.tsx` to use `budgetCalculationScope` for totals and `budgetCategoryScope` (visibility) for the list.
3. Update `BudgetCategoryScopeBar.tsx` to show dual toggles for each category (one for calculation, one for visibility).

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Update AppStateContext

**Files:**

- Modify: `public/src/context/AppStateContext.tsx`

**Step 1: Add `budgetCalculationScope` state and setter**

**Step 2: Commit**

```bash
git add public/src/context/AppStateContext.tsx
git commit -m "feat: add budgetCalculationScope to app state"
```

### Task 2: Update BudgetsPage logic

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsPage.tsx`

**Step 1: Separate calculation from visibility**

- `consumptionData` should compute ALL categories included in `budgetCalculationScope`.
- `stats` should use `consumptionData`.
- `displayConsumptionData` should filter `consumptionData` to only show those in `budgetCategoryScope`.

**Step 2: Update props for BudgetCategoryScopeBar**

**Step 3: Commit**

```bash
git add public/src/components/budgets-v2/BudgetsPage.tsx
git commit -m "refactor: separate calculation and visibility scopes in BudgetsPage"
```

### Task 3: Update BudgetCategoryScopeBar UI

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetCategoryScopeBar.tsx`

**Step 1: Update props and rendering**

- Change props to accept dual states.
- Render each category with two small toggle buttons: one with a "Calculator" icon and one with an "Eye" icon.

**Step 2: Commit**

```bash
git add public/src/components/budgets-v2/BudgetCategoryScopeBar.tsx
git commit -m "feat: implement dual-scope toggles in category selector"
```
