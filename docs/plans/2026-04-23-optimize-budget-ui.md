# Optimize Budget UI Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Declutter the Budget UI by showing only the main budgets (top 10 by limit) by default, with a toggle to see all.

**Architecture:**

1. Add `showAllBudgets` local state to `BudgetsPage.tsx`.
2. Sort and slice `consumptionData` when `showAllBudgets` is false.
3. Add a "Budgets principaux / Tous" toggle in the header area.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons.

---

### Task 1: Add filtering logic to BudgetsPage

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsPage.tsx`

**Step 1: Add `showAllBudgets` state**

Add near other states:

```typescript
const [showAllBudgets, setShowAllBudgets] = useState(false);
```

**Step 2: Apply sorting and slicing to consumptionData**

In the `consumptionData` useMemo or in a derived useMemo:

1. Sort by `montant` (limit) descending.
2. If `!showAllBudgets`, slice to top 10.

**Step 3: Add the toggle button in the UI**

Add a button next to "Mensuel / Annuel" or in the Categories section.

**Step 4: Commit**

```bash
git add public/src/components/budgets-v2/BudgetsPage.tsx
git commit -m "feat: limit budget display to top 10 by default"
```

---

### Task 2: Verification

**Step 1: Verify logic**

- Check that only 10 budgets are shown by default.
- Verify they are the ones with the largest limits.
- Click "Tous" and verify all 50+ categories appear.
- Click "Budgets principaux" and verify it goes back to 10.
