# Fix Budget Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the budget display in the budget tab by passing the correct budget data to the presentation component.

**Architecture:** The fix involves a single line change in the `BankinBudgetsContainer.tsx` component to pass the `totalExpenseBudget` to the `BankinBudgetMain` component instead of `totalIncomeBudget`.

**Tech Stack:** React, TypeScript

---

### Task 1: Correct the `totalBudget` prop

**Files:**

- Modify: `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

- [ ] **Step 1: Modify the `BankinBudgetMain` component call**

```typescript
------- SEARCH
totalBudget={budgetData.totalIncomeBudget}
=======
totalBudget={budgetData.totalExpenseBudget}
+++++++ REPLACE
```

- [ ] **Step 2: Commit the change**

```bash
git add public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx
git commit -m "fix(budget): display expense budget instead of income budget"
```
