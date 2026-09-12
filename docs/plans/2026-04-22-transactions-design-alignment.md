# Transactions Page Design Alignment Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the Transactions page (table, filters, and section) with the Unified Design System.

**Architecture:**

- Refactor `TransactionsTable.tsx` to use `glass-panel`, `font-serif` for amounts, and canonical color tokens.
- Refactor `TransactionFilters.tsx` to use the new glassmorphism and accent tokens.
- Update `TransactionsSection.tsx` layout to use `premium-container` and unified section headers.

**Tech Stack:** React, Tailwind CSS v4, Framer Motion, Lucide Icons.

---

### Task 1: Refactor TransactionsTable for Unified Design

**Files:**

- Modify: `public/src/components/TransactionsTable.tsx`

**Step 1: Simplify TransactionRow to remove isHighTech logic**
Update the row to use `border-white/5`, `hover:bg-glass`, and consistent spacing. Use `font-serif` and `tabular-nums` for amounts. Use `gold` for positive and `ruby` for negative amounts.

**Step 2: Update Category Icon styling**
Use `rounded-xl` and the `gold-muted` pattern for category icons.

**Step 3: Update Group Headers (À pointer / Historique)**
Use the sticky pattern with `backdrop-blur-md` and the label typography (`text-[10px] font-bold uppercase tracking-[0.2em]`).

**Step 4: Verify visually**
Check that `TransactionRow` uses the new design tokens.

**Step 5: Commit**

```bash
git add public/src/components/TransactionsTable.tsx
git commit -m "style: align TransactionsTable with unified design system"
```

### Task 2: Refactor TransactionFilters for Unified Design

**Files:**

- Modify: `public/src/components/TransactionFilters.tsx`

**Step 1: Update input and select styles**
Use `bg-ink-100`, `border-glass-border`, and `focus:ring-gold/20`.

**Step 2: Update buttons to use gold accent**
Replace blue accents with `gold`. Use `bg-gold` for primary actions and `bg-glass` for ghost buttons.

**Step 3: Update mobile drawer**
Align the mobile sheet with the "Luxury Dark" style: `bg-ink`, `rounded-t-[3rem]`, and unified typography.

**Step 4: Commit**

```bash
git add public/src/components/TransactionFilters.tsx
git commit -m "style: align TransactionFilters with unified design system"
```

### Task 3: Refactor TransactionsSection Layout

**Files:**

- Modify: `public/src/components/TransactionsSection.tsx`

**Step 1: Wrap content in premium-container**
Replace legacy layout classes with `premium-container`.

**Step 2: Implement unified section headers**
Align the "Transactions" header with the pattern in `DESIGN_SYSTEM.md`.

**Step 3: Update Balance Panel and AI Bar**
Apply `glass-panel` and `gold` accents to these auxiliary components.

**Step 4: Verify build**
Run: `npm run build`
Expected: Successful build.

**Step 5: Commit**

```bash
git add public/src/components/TransactionsSection.tsx
git commit -m "style: align TransactionsSection layout with unified design system"
```
