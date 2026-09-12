# Implementer Prompt

## Context

Goal: Migrate legacy budget management logic from `budget.js` into modular React components and hooks.
Current Task: Task 1 - Create useBudget Custom Hook.
File to Create: `public/src/hooks/useBudget.tsx`

## Requirements

- The hook must handle:
  - State for `viewMode` ('monthly', 'annual').
  - State for `monthKey` (YYYY-MM) and `year`.
  - Data fetching for `budgets`, `budgets_monthly`, `budgets_annual_history` from Firestore (using `state.db` as in other hooks).
  - Logic for computing budget vs. actuals, categories grouping, and sorting.
  - Expose CRUD actions for updating budget amounts (`saveMonthlyBudget`, `saveAnnualDefault`).
- Follow established patterns in the codebase (e.g., `useTransactions.tsx`, `usePatrimoine.tsx` if they exist).
- Use TypeScript for safety.

## Deliverables

- `public/src/hooks/useBudget.tsx`
- Commit with a meaningful message.
