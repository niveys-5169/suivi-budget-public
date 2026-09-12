# Budget Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate legacy budget management logic from `budget.js` into modular React components and hooks to unify the architecture.

**Architecture:**

- **Hooks:** `useBudget.tsx` for state (budget data, views, categories) and filtering logic.
- **Components:** `BudgetTable.tsx`, `BudgetCharts.tsx`, `BudgetControls.tsx`, `BudgetSummary.tsx`.
- **Integration:** Hybrid React mounting in `app.js` replacing `renderBudget` calls.

**Tech Stack:** React, TypeScript, Vite, Firebase Firestore.

---

### Task 1: Create useBudget Custom Hook

**Files:**

- Create: `public/src/hooks/useBudget.tsx`

- [ ] **Step 1: Implement useBudget hook**
  - Should handle:
    - State for `viewMode` ('monthly', 'annual').
    - State for `monthKey` (YYYY-MM) and `year`.
    - Data fetching for `budgets`, `budgets_monthly`, `budgets_annual_history`.
    - Logic for computing budget vs. actuals, categories grouping, and sorting.
    - CRUD actions for updating budget amounts (`saveMonthlyBudget`, `saveAnnualDefault`).

- [ ] **Step 2: Commit hook implementation**

### Task 2: Create Budget UI Components

**Files:**

- Create: `public/src/components/BudgetTable.tsx`
- Create: `public/src/components/BudgetCharts.tsx`
- Create: `public/src/components/BudgetSummary.tsx`

- [ ] **Step 1: Implement BudgetTable component**
  - Include sorting by category, budget, actual, diff.
  - Inline editing for budget values.
  - Checkboxes for category enabling.
- [ ] **Step 2: Implement BudgetCharts component (reusing Chart.js bridge)**
- [ ] **Step 3: Implement BudgetSummary component (KPI cards)**
- [ ] **Step 4: Commit components**

### Task 3: Create BudgetSection Container & Integration

**Files:**

- Create: `public/src/components/BudgetSection.tsx`
- Modify: `public/src/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Create BudgetSection component to orchestrate the UI**
- [ ] **Step 2: Update index.html to provide a single mount point for the budget section**
  - Replace `<div id="budget-table-container"></div>` with `<div id="budget-root"></div>`.
- [ ] **Step 3: Update app.js to mount BudgetSection and remove legacy budget.js dependency**
- [ ] **Step 4: Commit integration**
