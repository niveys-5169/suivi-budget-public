# Fix TypeScript Errors in Suivi-Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all requested TypeScript errors to achieve zero errors in `npm run typecheck`.

**Architecture:** Surgical fixes to type mismatches, missing properties, and incorrect type usage in various components and hooks.

**Tech Stack:** React, TypeScript, Firebase, Recharts.

---

### Task 1: Fix Transaction type mismatch in RAVEditor.tsx

**Files:**

- Modify: `public/src/components/budgets-v2/RAVEditor.tsx`

- [ ] **Step 1: Ensure Transaction uses the unified type**

Identify if there are any conflicting types. In `RAVEditor.tsx`, `Transaction` is imported from `../../types/banking.types`. The error suggests a mismatch. I will check the file again to see if there's a hidden local definition or if I need to cast.

- [ ] **Step 2: Apply fixes to RAVEditor.tsx**

Update `txList.forEach` and other parts to handle `Transaction` correctly.

### Task 2: Fix BankinBudgetGrid.tsx sparkline and color errors

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetGrid.tsx`

- [ ] **Step 1: Map sparkline data from { date, amount } to { day, amount }**

- [ ] **Step 2: Add default color if missing on CategoryDetail**

### Task 3: Fix BankinBudgetsContainer.tsx type and property errors

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

- [ ] **Step 1: Update CategoryDetail interface to include sparklineData and color**

- [ ] **Step 2: Fix mapBankinToInternal call by ensuring correct type or casting**

- [ ] **Step 3: Fix moisAffectation and other property accesses**

### Task 4: Fix InsightsFeed.tsx montant undefined and type errors

**Files:**

- Modify: `public/src/components/dashboard/InsightsFeed.tsx`

- [ ] **Step 1: Use (t.montant || 0) to handle undefined**

### Task 5: Fix SpendingAnalytics.tsx activeShape prop error

**Files:**

- Modify: `public/src/components/dashboard/SpendingAnalytics.tsx`

- [ ] **Step 1: Update renderActiveShape props to be more inclusive (use any or more fields)**

### Task 6: Fix DonutChart.tsx Pie activeIndex error

**Files:**

- Modify: `public/src/components/shared/DonutChart.tsx`

- [ ] **Step 1: Cast Pie component to any to bypass activeIndex type lag**

### Task 7: Fix BudgetContext.tsx duplicate id error

**Files:**

- Modify: `public/src/context/BudgetContext.tsx`

- [ ] **Step 1: Remove duplicate id in spread assignment**

### Task 8: Fix usePatrimoine.tsx Firebase Timestamp handling

**Files:**

- Modify: `public/src/hooks/usePatrimoine.tsx`

- [ ] **Step 1: Correctly handle toDate() on potential Timestamps**

### Task 9: Fix usePortfolio.tsx instanceof Date error

**Files:**

- Modify: `public/src/hooks/usePortfolio.tsx`

- [ ] **Step 1: Update portfolioTimestampMs type and checks**

### Task 10: Fix useRecurring.tsx and banking.types.ts for customAmount

**Files:**

- Modify: `public/src/types/banking.types.ts`
- Modify: `public/src/hooks/useRecurring.tsx`

- [ ] **Step 1: Add customAmount to RecurringExpense interface**

- [ ] **Step 2: Update useRecurring.tsx to use customAmount**

### Task 11: Final Verification

- [ ] **Step 1: Run npm run typecheck and verify zero errors**
