# Refined Recurring Transaction Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve recurring transaction detection accuracy by implementing a ±20% amount variance rule and requiring at least 3 occurrences within the last 3 months.

**Architecture:**

1. Update `detectRecurringTransactionsPure` in `public/src/utils/maths.ts` to use a more flexible grouping strategy.
2. Implement a grouping algorithm that considers both label similarity and amount variance (±20%).
3. Add a temporal filter to ensure only groups with 3+ occurrences in the last 90 days are proposed.

**Tech Stack:** TypeScript, Jest (for testing logic).

---

### Task 1: Refactor Detection Logic in maths.ts

**Files:**

- Modify: `public/src/utils/maths.ts`

- [ ] **Step 1: Update Grouping Strategy**
      Replace the rigid `signature = category||amountBucket` with a multi-pass grouping logic.

```typescript
// Proposed algorithm snippet for maths.ts:
// 1. Group by category
// 2. For each category, sub-group by label similarity (>= 0.7)
// 3. For each label group, sub-group by amount variance (±20%)
```

- [ ] **Step 2: Implement Temporal Filter**
      Ensure that the final candidates have at least 3 items where `date` >= `today - 90 days`.

```typescript
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
const recentCount = items.filter((tx) => new Date(tx.date) >= ninetyDaysAgo).length;
if (recentCount < 3) continue;
```

- [ ] **Step 3: Update `detectRecurringTransactionsPure` signature**
      Add a `referenceDate` parameter (defaulting to `new Date()`) to facilitate testing.

- [ ] **Step 4: Commit**

```bash
git add public/src/utils/maths.ts
git commit -m "feat(maths): implement ±20% amount variance and 3-month activity rule for recurring detection"
```

---

### Task 2: Unit Testing the New Logic

**Files:**

- Create: `public/src/utils/__tests__/maths.recurring.test.ts`

- [ ] **Step 1: Test Amount Variance**
      Verify that transactions of 95€, 100€, and 105€ are grouped together (variance < 20%).
      Verify that 50€ and 100€ are NOT grouped together.

- [ ] **Step 2: Test Temporal Activity**
      Verify that a series of transactions from 6 months ago (without recent ones) is NOT detected.
      Verify that 3 transactions in the last 90 days ARE detected.

- [ ] **Step 3: Run Tests**
      Run: `npm test public/src/utils/__tests__/maths.recurring.test.ts`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/utils/__tests__/maths.recurring.test.ts
git commit -m "test(maths): add comprehensive tests for refined recurring detection"
```

---

### Task 3: Final Verification in UI

- [ ] **Step 1: Visual Check**
      Navigate to **Analyse > Récurrences**.
      Verify that "pending" proposals now strictly follow the 3-month rule.
      Check that similar items with slight price variations (e.g., fuel, groceries) are correctly grouped under a single proposal.

- [ ] **Step 2: Run Lint**
      Run: `npm run lint`
      Expected: PASS
