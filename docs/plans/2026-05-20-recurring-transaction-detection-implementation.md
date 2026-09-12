# Recurring Transaction Detection Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the recurring transaction detection logic in `public/src/utils/maths.ts` to use a multi-pass grouping strategy, temporal filtering, and an updated function signature.

**Architecture:** The `detectRecurringTransactionsPure` function will be modified to implement a three-stage grouping process (category -> average label similarity -> amount variance), followed by a temporal filter to ensure detected patterns are recent. The function signature will be updated to accept a `referenceDate` for improved testability.

**Tech Stack:** TypeScript, `computeLabelSimilarity` (existing utility), `diffInDays` (existing utility).

---

### Task 1: Update `detectRecurringTransactionsPure` signature

**Files:**

- Modify: `public/src/utils/maths.ts`

- [ ] **Step 1: Update function signature**

```typescript
export function detectRecurringTransactionsPure(
  transactions: TransactionLike[],
  expectedIntervals = [7, 14, 15, 30, 31, 60, 90, 180, 365],
  referenceDate: Date = new Date(),
): RecurringItem[] {
```

- [ ] **Step 2: Commit**

```bash
git add public/src/utils/maths.ts
git commit -m "refactor(maths): update detectRecurringTransactionsPure signature with referenceDate"
```

### Task 2: Refactor Grouping Logic - Initial Categorization and Sub-grouping Setup

**Files:**

- Modify: `public/src/utils/maths.ts`

- [ ] **Step 1: Refactor existing category grouping and initialize `allGroupedTransactions`**

Locate the existing category grouping logic and the `allGroupedTransactions` initialization. We will modify this to correctly handle the new multi-pass grouping.

```typescript
// ... (imports and other functions)

export function detectRecurringTransactionsPure(
  transactions: TransactionLike[],
  expectedIntervals = [7, 14, 15, 30, 31, 60, 90, 180, 365],
  referenceDate: Date = new Date(),
): RecurringItem[] {
  const ninetyDaysAgo = new Date(referenceDate);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const allGroupedTransactions: TransactionLike[][] = [];
  const transactionsByCategory: Record<string, TransactionLike[]> = {};

  for (const tx of transactions) {
    if (!tx?.date || !Number.isFinite(Number(tx?.montant))) continue;
    const amount = Number(tx.montant);
    if (amount === 0) continue;

    const category = String(tx.categorie || '(Sans catégorie)')
      .trim()
      .toLowerCase();
    if (!transactionsByCategory[category]) transactionsByCategory[category] = [];
    transactionsByCategory[category].push(tx);
  }

  // Iterate over each category's transactions to perform sub-grouping
  for (const categoryTxs of Object.values(transactionsByCategory)) {
    const categorySpecificGroups: TransactionLike[][] = [];

    for (const tx of categoryTxs) {
      const txLabel = String(tx.libelle || '').trim();
      const txAmount = Math.abs(Number(tx.montant));

      let foundGroup = false;
      for (const group of categorySpecificGroups) {
        if (group.length === 0) continue;

        // Calculate average similarity against existing group members
        let totalSimilarity = 0;
        for (const existingTx of group) {
          totalSimilarity += computeLabelSimilarity(txLabel, String(existingTx.libelle || '').trim());
        }
        const averageSimilarity = totalSimilarity / group.length;

        if (averageSimilarity >= 0.7) {
          // Amount Variance check (±20%)
          const groupAvgAmount = group.reduce((sum, t) => sum + Math.abs(Number(t.montant)), 0) / group.length;
          const amountLowerBound = groupAvgAmount * 0.8;
          const amountUpperBound = groupAvgAmount * 1.2;

          if (txAmount >= amountLowerBound && txAmount <= amountUpperBound) {
            group.push(tx);
            foundGroup = true;
            break;
          }
        }
      }

      if (!foundGroup) {
        categorySpecificGroups.push([tx]);
      }
    }
    allGroupedTransactions.push(...categorySpecificGroups);
  }
  // console.log('--- allGroupedTransactions ---'); // Keep for debugging if needed
  // console.log(JSON.stringify(allGroupedTransactions, null, 2)); // Keep for debugging if needed

  const recurring: RecurringItem[] = [];

  // ... (rest of the function, which will be updated in subsequent tasks)
```

- [ ] **Step 2: Remove old grouping logic**

Remove the `byCategory` and `allGroupedTransactions` loop that was previously iterating through `byCategory` and creating groups based on strict label/amount matching. The new logic replaces this.

The following block needs to be replaced:

```typescript
const allGroupedTransactions: TransactionLike[][] = [];

// Group 2 & 3: By Label Similarity and Amount Variance
for (const categoryTxs of Object.values(byCategory)) {
  const categoryGroups: TransactionLike[][] = [];

  for (const tx of categoryTxs) {
    const txLabel = String(tx.libelle || '').trim();
    const txAmount = Math.abs(Number(tx.montant));

    let foundGroup = false;
    for (const group of categoryGroups) {
      if (group.length === 0) continue;

      const groupAvgAmount =
        group.reduce((sum, t) => sum + Math.abs(Number(t.montant)), 0) / group.length;

      let isLabelSimilar = false;
      // Check similarity against all labels in the group
      for (const existingTx of group) {
        if (computeLabelSimilarity(txLabel, String(existingTx.libelle || '').trim()) >= 0.7) {
          isLabelSimilar = true;
          break;
        }
        if (
          computeLabelSimilarity(txLabel, String(existingTx.libelle || '').trim()) === 1 &&
          txAmount === Math.abs(Number(existingTx.montant))
        ) {
          isLabelSimilar = true;
          break;
        }
      }

      if (isLabelSimilar) {
        // Amount Variance check (±20%)
        const amountLowerBound = groupAvgAmount * 0.8;
        const amountUpperBound = groupAvgAmount * 1.2;
        if (txAmount >= amountLowerBound && txAmount <= amountUpperBound) {
          group.push(tx);
          foundGroup = true;
          break;
        }
      }
    }

    if (!foundGroup) {
      categoryGroups.push([tx]);
    }
  }
  allGroupedTransactions.push(...categoryGroups);
}
```

And replace this with:

```typescript
// Removed old grouping logic - replaced by the new multi-pass grouping.
```

- [ ] **Step 3: Commit**

```bash
git add public/src/utils/maths.ts
git commit -m "feat(maths): implement multi-pass grouping logic for recurring transaction detection"
```

### Task 3: Implement Temporal Filter

**Files:**

- Modify: `public/src/utils/maths.ts`

- [ ] **Step 1: Refine Temporal Filter in the main loop**

Adjust the temporal filter to correctly apply to `allGroupedTransactions` and ensure it uses `referenceDate`. This step ensures that only relevant, recent groups proceed for recurrence analysis. The existing temporal filter needs to be updated to account for the new grouping.

```typescript
  // ... (previous code)

  for (const group of allGroupedTransactions) {
    // Temporal Filter: at least 3 occurrences in the last 90 days
    const recentTxs = group.filter(tx => {
      const txDate = parseDateInput(tx.date || null);
      return txDate && txDate >= ninetyDaysAgo;
    });

    if (recentTxs.length < 3) continue; // Only proceed if enough recent transactions

    const sorted = [...recentTxs].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (sorted.length < 3) continue; // Redundant check, but good for clarity after filtering

    // ... (rest of the function logic for calculating intervals and recurrence)
```

- [ ] **Step 2: Commit**

```bash
git add public/src/utils/maths.ts
git commit -m "feat(maths): implement temporal filter (3 tx in 90 days) for recurring detection"
```

### Task 4: Finalizing `RecurringItem` creation and sorting

**Files:**

- Modify: `public/src/utils/maths.ts`

- [ ] **Step 1: Ensure `RecurringItem` creation uses correct values**

Review the `recurring.push` section to ensure that the `label`, `category`, `compte`, `avgAmount`, `freq`, `count`, `lastDate`, `avgInterval`, and `periodMatchRatio` are correctly derived from the `sorted` (recent and filtered) transactions.

The existing code largely handles this correctly but a review is necessary to ensure it aligns with the new grouping and filtering. No major code changes are expected here unless an issue is found.

- [ ] **Step 2: Commit**

```bash
git add public/src/utils/maths.ts
git commit -m "refactor(maths): ensure RecurringItem creation aligns with new grouping and filtering"
```
