# Budget Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate business logic from `budget.js` to `useBudget.tsx` and implement a compatibility bridge.

**Architecture:**

- **`useBudget.tsx`**: State, Firebase, Logic.
- **Legacy Compatibility**: Keep `budget.js` as a light bridge to the new hook.

**Tech Stack:** React, TypeScript, Firestore.

---

### Task 1: Refactor Logic into useBudget Hook

**Files:**

- Modify: `public/src/hooks/useBudget.tsx`
- Modify: `public/src/budget.js`

- [ ] **Step 1: Move state & logic to `useBudget.tsx`**
  - Extract: `BUDGET_MONTH_KEY`, `BUDGET_VIEW_MODE`, `currentMonthKey`.
  - Extract: `loadBudgets` (async), `getBudgetCategoryCandidates_`.
- [ ] **Step 2: Ensure compatibility bridge**
  - Keep `window` exports in `budget.js` but have them call `useBudget` (via a shared store or event).
- [ ] **Step 3: Commit and verify**

### Task 2: Update UI Components

**Files:**

- Modify: `public/src/components/BudgetTable.tsx`
- Modify: `public/src/components/BudgetCharts.tsx`
- Modify: `public/src/components/BudgetSummary.tsx`

- [ ] **Step 1: Update components to consume data from `useBudget` hook**
- [ ] **Step 2: Commit and verify**
