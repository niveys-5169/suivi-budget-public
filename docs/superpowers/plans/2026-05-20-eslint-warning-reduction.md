# ESLint Warning Reduction (Utilities & Services) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ESLint warnings (primarily `any` types and unused imports) in utility and service files to reach "Zero Warning" while maintaining business logic.

**Architecture:** Use existing TypeScript interfaces from `banking.types.ts`, `balances.ts`, and `TransactionContext.tsx` to replace `any`. Remove unused code identified by ESLint.

**Tech Stack:** React, TypeScript, Firebase/Firestore, ESLint.

---

### Task 1: Fix Services (`firebase.ts` & `firebase-api.ts`)

**Files:**

- Modify: `public/src/services/firebase.ts`
- Modify: `public/src/services/firebase-api.ts`

- [ ] **Step 1: Remove unused import in `firebase.ts`**
      Remove `getApp` from `firebase/app` import.

- [ ] **Step 2: Type `clientPayload` and error in `firebase-api.ts`**
      Replace `any` for `clientPayload` with `Record<string, unknown> | null`.
      Replace `any` in catch block with `Error` or `unknown`.

- [ ] **Step 3: Verify changes**
      Run: `npx eslint public/src/services/firebase.ts public/src/services/firebase-api.ts`
      Expected: No warnings for these files.

### Task 2: Fix Balance Mapping Utility

**Files:**

- Modify: `public/src/utils/balanceMapping.ts`

- [ ] **Step 1: Type `tx` in `balanceMapping.ts`**
      Import `Transaction` from `../context/TransactionContext`.
      Replace `tx: any` with `tx: Transaction` in `mapLinxoToFirestore` and `mapLinxoBalanceToFirestore`.

- [ ] **Step 2: Verify changes**
      Run: `npx eslint public/src/utils/balanceMapping.ts`
      Expected: No warnings.

### Task 3: Fix Category Utilities

**Files:**

- Modify: `public/src/utils/categoryUtils.ts`

- [ ] **Step 1: Remove unused import in `categoryUtils.ts`**
      Remove `FSCache` from `../store.js` import.

- [ ] **Step 2: Type `state` and `value` in `categoryUtils.ts`**
      Type `userPrefs` check properly.
      Replace `value: any` in `normalizeSearchValue` with `string | number | null | undefined`.

- [ ] **Step 3: Verify changes**
      Run: `npx eslint public/src/utils/categoryUtils.ts`
      Expected: No warnings.

### Task 4: Fix Dashboard Mapper Utility

**Files:**

- Modify: `public/src/utils/dashboardMapper.ts`

- [ ] **Step 1: Remove unused import in `dashboardMapper.ts`**
      Remove `CATEGORY_META` from `../constants/categoryMetadata` import.

- [ ] **Step 2: Type `budgets` in `dashboardMapper.ts`**
      Import `BudgetBase` from `../types/banking.types`.
      Replace `budgets: any[]` with `budgets: BudgetBase[]`.

- [ ] **Step 3: Verify changes**
      Run: `npx eslint public/src/utils/dashboardMapper.ts`
      Expected: No warnings.

### Task 5: Fix Date Utility

**Files:**

- Modify: `public/src/utils/date.ts`

- [ ] **Step 1: Type `tx` in `getAssignedMonthKey`**
      Import `Transaction` from `../context/TransactionContext` (or use a partial if easier).
      Replace `tx: any` with `tx: { moisAffectation?: string; date?: string }`.

- [ ] **Step 2: Verify changes**
      Run: `npx eslint public/src/utils/date.ts`
      Expected: No warnings.

### Task 6: Fix Budget Helpers (Calculation Logic)

**Files:**

- Modify: `public/src/utils/budgetHelpers.ts`

- [ ] **Step 1: Type all `any` occurrences in `budgetHelpers.ts`**
      Use `BudgetBase` and `Transaction` types.
      Type `state` correctly (likely needs a local interface if not exported).

- [ ] **Step 2: Verify changes and run typecheck**
      Run: `npx eslint public/src/utils/budgetHelpers.ts`
      Run: `npm run typecheck`
      Expected: No lint warnings AND no type errors.
