# Dashboard Design Alignment Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the Dashboard (hero, navigation, analytics, and lists) with the Unified Design System.

**Architecture:**

- Refactor `Dashboard.tsx` to remove legacy backgrounds and use `premium-container`.
- Standardize section headers across the dashboard.
- Refactor `BalanceHero.tsx` and `AccountCards.tsx` for high-fidelity glassmorphism.
- Refactor `SpendingAnalytics.tsx` and `TransactionList.tsx` to match the "Transactions" page aesthetic.

**Tech Stack:** React, Tailwind CSS v4, Framer Motion, Recharts, Lucide Icons.

---

### Task 1: Refactor Dashboard & Navigation

**Files:**

- Modify: `public/src/components/dashboard/Dashboard.tsx`
- Modify: `public/src/components/DashboardNavigation.tsx`

**Step 1: Clean up Dashboard.tsx**
Remove fixed background divs (now in root). Wrap content in `premium-container`. Update sticky headers to use `glass-panel` tokens and consistent typography.

**Step 2: Align DashboardNavigation**
Standardize the period selector and labels. Use `gold` accent for the active range badge instead of blue.

**Step 3: Commit**

```bash
git add public/src/components/dashboard/Dashboard.tsx public/src/components/DashboardNavigation.tsx
git commit -m "style: align Dashboard layout and navigation with unified design system"
```

### Task 2: Refactor Hero & Account Cards

**Files:**

- Modify: `public/src/components/dashboard/BalanceHero.tsx`
- Modify: `public/src/components/dashboard/AccountCards.tsx`

**Step 1: Refine BalanceHero**
Ensure `font-serif` and `tabular-nums` for the main amount. Use `glass-panel` border and background tokens. Tighten the variation badges (`gold` for positive, `ruby` for negative).

**Step 2: Refine AccountCards**
Align the individual card design with the "Patrimoine" tables: better glassmorphism, consistent icons, and standard `font-serif` for balances.

**Step 3: Commit**

```bash
git add public/src/components/dashboard/BalanceHero.tsx public/src/components/dashboard/AccountCards.tsx
git commit -m "style: align Dashboard Hero and Account cards with unified design system"
```

### Task 3: Refactor Analytics & Lists

**Files:**

- Modify: `public/src/components/dashboard/SpendingAnalytics.tsx`
- Modify: `public/src/components/dashboard/TransactionList.tsx`

**Step 1: Standardize SpendingAnalytics**
Update the donut chart tooltip and legend to use canonical design tokens (`ink-100`, `glass-border`, etc.).

**Step 2: Standardize TransactionList**
Align items with the main `TransactionsTable` style: `font-bold` merchant names, `font-serif` amounts, and high-fidelity category badges. Use `gold` for income.

**Step 3: Verify build**
Run: `npm run build`
Expected: Successful build.

**Step 4: Commit**

```bash
git add public/src/components/dashboard/SpendingAnalytics.tsx public/src/components/dashboard/TransactionList.tsx
git commit -m "style: align Dashboard analytics and lists with unified design system"
```
