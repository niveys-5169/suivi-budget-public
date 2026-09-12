# TypeScript Error Resolution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all remaining TypeScript errors in the Suivi-Budget project, focusing on the Unified Transaction type and other common mismatches.

**Architecture:** Systematic fix of type errors across the project. Prioritize fixes in common types and components to reduce the error count quickly.

**Tech Stack:** TypeScript, React, Vite.

---

### Task 1: Fix AnalyseSection.tsx and related DrillDowns

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`
- Modify: `public/src/components/analyse/drilldowns/CategoryDrillDown.tsx`
- Modify: `public/src/components/analyse/drilldowns/RecurringDrillDown.tsx`

- [ ] **Step 1: Fix 'tx.montant' possibly undefined in AnalyseSection.tsx**
      Replace `tx.montant` with `(tx.montant || 0)` in filters and reduces.
- [ ] **Step 2: Fix 'TransactionFilters' type usage**
      Change `as Partial<TransactionFilters>` to `as Partial<typeof TransactionFilters>` or ensure the interface is correctly imported/defined.
- [ ] **Step 3: Fix DrillDown component props mismatch**
      Ensure `Transaction` type imported in DrillDowns matches the unified type.
- [ ] **Step 4: Fix 'tx.montant' in DrillDowns**
      Use `(tx.montant || 0)` or `fmt(tx.montant || 0)`.

### Task 2: Fix BalanceHistoryModal.tsx

**Files:**

- Modify: `public/src/components/BalanceHistoryModal.tsx`

- [ ] **Step 1: Import 'BaseBalance'**
      Import `BaseBalance` from `../types/balances`.
- [ ] **Step 2: Handle 'details.manual_value' potentially null**
      Wrap in `fmt(details.manual_value || 0)`.
- [ ] **Step 3: Fix 'BaseBalance' casting**
      Ensure casting uses the imported `BaseBalance`.

### Task 3: Fix BudgetDashboardModal.tsx

**Files:**

- Modify: `public/src/components/BudgetDashboardModal.tsx`

- [ ] **Step 1: Import 'Transaction'**
      Import `Transaction` from `../types/banking.types`.
- [ ] **Step 2: Use unified 'Transaction' type in table rendering**

### Task 4: Fix BankinBudgetsContainer.tsx and Grid

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`
- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetGrid.tsx`

- [ ] **Step 1: Fix 'CategoryDetail' interface**
      Ensure `sparklineData` type matches `BudgetConsumption`.
- [ ] **Step 2: Fix property naming 'sparkline' vs 'sparklineData'**
      Standardize on `sparklineData`.

### Task 5: Fix Aurum Dashboard and related V2 components

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumDashboard.tsx`
- Modify: `public/src/components/dashboard/v2/AurumPortfolioDailyChart.tsx`
- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumWealthDetailedChart.tsx`
- Modify: `public/src/components/dashboard/v2/AurumWealthEvolution.tsx`

- [ ] **Step 1: Fix 'Transaction' mapping in AurumDashboard.tsx**
      Handle `libelle` potentially undefined.
- [ ] **Step 2: Fix 'unknown' payload fields in Charts**
      Use type guards or casting to access `fullDate`, `date`, etc.
- [ ] **Step 3: Fix 'itemVariants' type in AurumTransactionsPage.tsx**
      Ensure `transition.type` is a valid `AnimationGeneratorType` or cast to `any`.
- [ ] **Step 4: Fix 'tx.montant' in AurumTransactionsPage.tsx**

### Task 6: Fix PlacementFormModal.tsx and WealthPage.tsx

**Files:**

- Modify: `public/src/components/PlacementFormModal.tsx`
- Modify: `public/src/components/WealthPage.tsx`

- [ ] **Step 1: Map legacy properties in PlacementFormModal.tsx**
      Handle `name`, `balance`, `account` vs `nom`, `montant`, `compte`.
- [ ] **Step 2: Fix 'selectedAsset' type mismatch in WealthPage.tsx**

### Task 7: Fix balanceMapping.test.ts

**Files:**

- Modify: `tests/utils/balanceMapping.test.ts`

- [ ] **Step 1: Fix 'status' literal mismatches**
      Update tests to use valid `status` values defined in `BaseBalance`.
- [ ] **Step 2: Add missing properties to mock 'BaseBalance' objects**
      Ensure all required properties like `id`, `compte`, `current_balance`, `source`, `source_timestamp` are present.

### Task 8: Fix TransactionGroupedList.tsx and TransactionsSection.tsx

**Files:**

- Modify: `public/src/components/transactions/TransactionGroupedList.tsx`
- Modify: `public/src/components/TransactionsSection.tsx`

- [ ] **Step 1: Fix 'tx.montant' possibly undefined**
- [ ] **Step 2: Fix 'itemVariants' easing values**
      Ensure `ease` values are valid (e.g. use string names if number arrays fail in certain contexts, or cast).
- [ ] **Step 3: Fix 'onFilterChange' type error**

### Task 9: Resolve remaining common hook/util errors

**Files:**

- Modify: `public/src/hooks/useAlerts.tsx`
- Modify: `public/src/hooks/useFinanceQA.ts`
- Modify: `public/src/hooks/useGlobalSearch.tsx`
- Modify: `public/src/utils/dashboardMapper.ts`
- Modify: `public/src/utils/filterTransactions.ts`

- [ ] **Step 1: Fix optional property issues in hooks**
- [ ] **Step 2: Ensure type compatibility between 'Transaction' and 'TxLike'**
