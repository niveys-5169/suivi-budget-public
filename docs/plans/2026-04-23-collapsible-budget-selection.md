# Collapsible Budget Selection Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hide the bulky category selection list by default and allow users to manually pick budgets to show/hide.

**Architecture:**

1. Add `showScopeFilters` state to `BudgetsPage.tsx` to toggle the scope bar visibility.
2. Add a "Sélecteur" toggle button in the header.
3. Keep the "Principaux" vs "Tous" logic but ensure it correctly filters based on the user's manual selection (the scope).

**Tech Stack:** React, TypeScript, Tailwind CSS, Framer Motion.

---

### Task 1: Make scope bar collapsible in BudgetsPage

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsPage.tsx`

**Step 1: Add `isScopeVisible` state**

```typescript
const [isScopeVisible, setIsScopeVisible] = useState(false);
```

**Step 2: Add toggle button in header**

Add a button with `Settings2` or `ListFilter` icon next to existing buttons.

**Step 3: Wrap `BudgetCategoryScopeBar` with AnimatePresence/motion**

Only show it if `isScopeVisible` is true.

**Step 4: Commit**

```bash
git add public/src/components/budgets-v2/BudgetsPage.tsx
git commit -m "feat: make budget category selector collapsible"
```

### Task 2: Refine filtering logic to respect manual selection

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsPage.tsx`

**Step 1: Update `displayConsumptionData`**

Ensure it only shows budgets that are both:

1. In the `budgetCategoryScope` (manual selection).
2. Part of the top 10 (if `!showAllBudgets`).

**Step 2: Commit**

```bash
git add public/src/components/budgets-v2/BudgetsPage.tsx
git commit -m "fix: respect manual selection in budget filtering logic"
```
