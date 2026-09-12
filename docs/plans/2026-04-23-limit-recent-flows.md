# Limit Recent Flows and Add "Load More" Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limit the display of recent transactions to 10 by default and provide a "Voir plus" button to load 10 more at a time.

**Architecture:**

1.  Increase the number of transactions mapped in the data mapper to ensure we have enough to display more.
2.  Add local state to `Dashboard.tsx` to manage the visible count.
3.  Slice the transactions in the render method of `Dashboard.tsx`.
4.  Add a button at the bottom of the list to increase the count.

**Tech Stack:** React, TypeScript, Tailwind CSS.

---

### Task 1: Increase transaction limit in mapper

**Files:**

- Modify: `public/src/utils/dashboardMapper.ts`

**Step 1: Increase the slice from 20 to 100**

Modify line 47 of `public/src/utils/dashboardMapper.ts`:

```typescript
  const recentTransactions: Tx[] = transactions.slice(0, 100).map(t => ({
```

**Step 2: Commit**

```bash
git add public/src/utils/dashboardMapper.ts
git commit -m "refactor: increase recent transactions limit in mapper to 100"
```

### Task 2: Implement "Load More" in Dashboard component

**Files:**

- Modify: `public/src/components/dashboard/Dashboard.tsx`

**Step 1: Add visibleCount state**

Add at the top of the component:

```typescript
const [visibleTransactionsCount, setVisibleTransactionsCount] = useState(10);
```

**Step 2: Limit transactions passed to TransactionList**

In the render method, find where `TransactionList` is called and slice `data.recentTransactions`.

**Step 3: Add "Voir plus" button**

Add the button after the `TransactionList` if there are more transactions to show.

**Step 4: Commit**

```bash
git add public/src/components/dashboard/Dashboard.tsx
git commit -m "feat: limit recent flows to 10 and add 'Voir plus' button"
```

### Task 3: Verification

**Step 1: Verify UI behavior**

- Check that only 10 transactions are shown initially.
- Click "Voir plus" and verify 10 more appear.
- Verify the button disappears when all transactions are shown.
