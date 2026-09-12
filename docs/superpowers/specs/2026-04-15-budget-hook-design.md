# Budget Logic Migration Design

Migrate legacy budget logic from `public/src/budget.js` to `public/src/hooks/useBudget.tsx`.

## Architecture

- Move state management (budgets, monthly, annualHistory) and `loadBudgets` logic into `useBudget`.
- `public/src/budget.js` will act as a bridge for legacy global access.

## State Structure

- `budgets`: Array of default budget objects.
- `monthly`: Array of monthly budget objects.
- `annualHistory`: Array of annual budget objects.

## Helper Functions

- `getBudgetCategoryCandidates_()` exposed via the hook for UI components.

## Implementation Plan

1. Update `useBudget.tsx`.
2. Update `budget.js` to use the hook's state (via a shared store if necessary or just a bridge).
3. Add tests in `tests/hooks/useBudget.test.ts`.
