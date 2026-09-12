# Budget Logic Refactor Design

**Goal:** Refactor budget business logic into a React-native hook while maintaining a compatibility layer for existing legacy UI elements.

**Architecture:**

1. **`useBudget.tsx`**: Centralized hook managing state, Firebase interactions, and calculations.
2. **`BudgetBridge.ts`**: Minimal layer exposing legacy global functions that map to `useBudget` state/actions.
3. **Components**: `BudgetTable`, `BudgetCharts`, `BudgetSummary` (React) will consume `useBudget` directly.

**Design Details:**

- **State Migration**: Local variables from `budget.js` (e.g., `BUDGET_MONTH_KEY`, `BUDGET_VIEW_MODE`) move into `useBudget` as `useState` or `useMemo` hooks.
- **Legacy Compatibility**:
  - `window.renderBudget` will trigger a React state change or a custom event that forces components to re-render.
  - Global window functions (`setBudgetViewMode`, `shiftBudgetMonth`) will be redirected to call the hook's setter functions.
- **Firebase Persistence**: `loadBudgets` and CRUD actions move into the hook to centralize Firestore access.

**Trade-offs**:

- This approach introduces a temporary tight coupling between React and global JS, but ensures zero feature regression during the migration.
- "Cleaning up" after everything works will involve removing these bridge functions and the legacy dependency on `window`.

**Approval Request**:

- Does this dual-layer approach (Logic in Hook + Global Bridge) meet your requirement of "everything works as before" while allowing the refactor?
