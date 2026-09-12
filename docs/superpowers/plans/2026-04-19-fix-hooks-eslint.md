# ESLint Fixes for Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix ESLint warnings (@typescript-eslint/no-explicit-any and @typescript-eslint/no-unused-vars) in five hook files.

**Architecture:** Replace `any` with specific interfaces or `unknown` (with type guards), and remove unused variables/imports.

**Tech Stack:** React, TypeScript, Firebase, ESLint.

---

### Task 1: Fix useDashboard.tsx

**Files:**

- Modify: `public/src/hooks/useDashboard.tsx`

- [ ] **Step 1: Remove unused useAuth and fix recurringSettings type**
- [ ] **Step 2: Verify with lint**

### Task 2: Fix useFinanceQA.ts

**Files:**

- Modify: `public/src/hooks/useFinanceQA.ts`

- [ ] **Step 1: Fix any in callGemini and callOpenAI, remove unused sendMessage**
- [ ] **Step 2: Verify with lint**

### Task 3: Fix usePatrimoine.tsx

**Files:**

- Modify: `public/src/hooks/usePatrimoine.tsx`

- [ ] **Step 1: Remove unused dbPortfolio, fix any in placementHistory, totals, and latestPortfolioEntry**
- [ ] **Step 2: Verify with lint**

### Task 4: Fix usePlacements.tsx

**Files:**

- Modify: `public/src/hooks/usePlacements.tsx`

- [ ] **Step 1: Fix any in Placement type and catch blocks**
- [ ] **Step 2: Verify with lint**

### Task 5: Fix usePortfolio.tsx

**Files:**

- Modify: `public/src/hooks/usePortfolio.tsx`

- [ ] **Step 1: Fix any in Holding, helper functions, instruments, and catch blocks**
- [ ] **Step 2: Verify with lint**

### Task 6: Final Verification

- [ ] **Step 1: Run full typecheck and lint**
