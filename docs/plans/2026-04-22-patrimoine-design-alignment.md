# Patrimoine Design Alignment Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the Patrimoine section (summary, tables, and charts) with the Unified Design System.

**Architecture:**

- Refactor `PatrimoineSection.tsx` to use `premium-container` and unified section headers.
- Refactor `PatrimoineSummary.tsx` to use the "Hero" amount in `font-serif` and KPIS cards.
- Refactor `CourantsTable.tsx`, `SavingsTable.tsx`, and `PlacementsTable.tsx` to use the `glass-panel` and unified table pattern.
- Refactor `PatrimoineCharts.tsx` to use `glass-panel` cards for charts.

**Tech Stack:** React, Tailwind CSS v4, Framer Motion, Lucide Icons, Recharts (implied).

---

### Task 1: Refactor PatrimoineSection & Summary

**Files:**

- Modify: `public/src/components/PatrimoineSection.tsx`
- Modify: `public/src/components/PatrimoineSummary.tsx`

**Step 1: Align PatrimoineSection layout**
Use `premium-container`. Update header with "Patrimoine Privé" title and Activity icon.

**Step 2: Align PatrimoineSummary Hero & KPIS**
Implement the "Hero" section with `font-serif` for the total amount. Replace the flex row of KPIS with the 3-column grid specified in `DESIGN_SYSTEM.md`. Use `gold` for "Comptes Courants", `emerald` for "Épargne", and `blue` for "Investissements".

**Step 3: Update Owner Filter Chips**
Use the unified chip pattern with `bg-gold-muted` for selected states.

**Step 4: Commit**

```bash
git add public/src/components/PatrimoineSection.tsx public/src/components/PatrimoineSummary.tsx
git commit -m "style: align PatrimoineSection and Summary with unified design system"
```

### Task 2: Refactor Patrimoine Tables (Courants, Savings, Placements)

**Files:**

- Modify: `public/src/components/CourantsTable.tsx`
- Modify: `public/src/components/SavingsTable.tsx`
- Modify: `public/src/components/PlacementsTable.tsx`

**Step 1: Apply glass-panel and unified table styles**
Wrap each table in a `glass-panel` with `rounded-[2rem]`. Use `text-[10px] font-black uppercase tracking-[0.2em]` for table headers.

**Step 2: Update typography for amounts**
Use `font-serif` and `tabular-nums` for all balances. Use `gold` for positive and `ruby` for negative balances.

**Step 3: Update badges and status indicators**
Use the unified badge pattern for owners and reconciliation status.

**Step 4: Commit**

```bash
git add public/src/components/CourantsTable.tsx public/src/components/SavingsTable.tsx public/src/components/PlacementsTable.tsx
git commit -m "style: align Patrimoine tables with unified design system"
```

### Task 3: Refactor PatrimoineCharts & Verify

**Files:**

- Modify: `public/src/components/PatrimoineCharts.tsx`

**Step 1: Apply glass-panel to chart cards**
Use `glass-panel` for each chart container. Ensure charts use the canonical color tokens.

**Step 2: Verify build**
Run: `npm run build`
Expected: Successful build.

**Step 3: Commit**

```bash
git add public/src/components/PatrimoineCharts.tsx
git commit -m "style: align PatrimoineCharts with unified design system"
```
