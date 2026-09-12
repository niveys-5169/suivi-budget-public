# ESLint Cleanup: Hooks and Contexts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ESLint warnings (@typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars) in prioritized hooks and context files.

**Architecture:** Replace `any` with strongly typed interfaces, clean up unused code, and ensure type safety using `npm run typecheck`.

**Tech Stack:** React, TypeScript, Firebase (Firestore).

---

### Task 1: Type Definitions Cleanup in banking.types.ts

**Files:**

- Modify: `public/src/types/banking.types.ts`

- [ ] **Step 1: Add missing shared interfaces**
      Add `OwnerMapping`, `RavConfig`, and shared Budget-related types.

```typescript
export interface OwnerMapping {
  owners: string[];
  accounts: Record<string, string>;
  savings_patterns: Record<string, string>;
  default_owner: string;
}

export interface RavConfig {
  revenu_mensuel_net: number | null;
  revenu_categories: string[] | null;
  depense_categories: string[] | null;
}

export interface BudgetBase {
  id: string;
  categorie: string;
  nom: string;
  montant: number;
  actif: boolean;
  type: 'mensuel' | 'annuel';
  updatedAt?: any; // Will refine Firestore Timestamp if possible
}
```

### Task 2: Fix BudgetContext.tsx

**Files:**

- Modify: `public/src/context/BudgetContext.tsx`

- [ ] **Step 1: Define local interfaces and replace any**

```typescript
interface MonthlyBudget {
  id: string;
  month: string;
  mois: string; // computed
  categorie: string;
  montant: number;
  budget: number; // computed
  updatedAt?: any;
}

interface AnnualBudget {
  id: string;
  year: string;
  categorie: string;
  annualMontant: number;
  budget: number; // computed
  updatedAt?: any;
}
```

- [ ] **Step 2: Update state and usage of any**
- [ ] **Step 3: Run typecheck**
      Run: `npm run typecheck`

### Task 3: Fix TransactionContext.tsx

**Files:**

- Modify: `public/src/context/TransactionContext.tsx`

- [ ] **Step 1: Fix importedAt type and any in validateTransaction**
- [ ] **Step 2: Clean up state.ALL_TX casting**
- [ ] **Step 3: Run typecheck**

### Task 4: Fix GlobalDataContext.tsx

**Files:**

- Modify: `public/src/context/GlobalDataContext.tsx`

- [ ] **Step 1: Use OwnerMapping and RavConfig interfaces**
- [ ] **Step 2: Define RecurringSetting interface**
- [ ] **Step 3: Run typecheck**

### Task 5: Fix usePatrimoine.tsx

**Files:**

- Modify: `public/src/hooks/usePatrimoine.tsx`

- [ ] **Step 1: Fix placementHistory and internal reducer types**
- [ ] **Step 2: Run typecheck**

### Task 6: Fix usePortfolio.tsx

**Files:**

- Modify: `public/src/hooks/usePortfolio.tsx`

- [ ] **Step 1: Fix updatedAt, helper function signatures, and catch blocks**
- [ ] **Step 2: Run typecheck**

### Task 7: Fix usePlacements.tsx

**Files:**

- Modify: `public/src/hooks/usePlacements.tsx`

- [ ] **Step 1: Fix updatedAt and catch blocks**
- [ ] **Step 2: Run typecheck**

### Task 8: Fix useDashboard.tsx and useFinanceQA.ts

**Files:**

- Modify: `public/src/hooks/useDashboard.tsx`
- Modify: `public/src/hooks/useFinanceQA.ts`

- [ ] **Step 1: Fix Record<string, any> and error handling types**
- [ ] **Step 2: Run typecheck**
