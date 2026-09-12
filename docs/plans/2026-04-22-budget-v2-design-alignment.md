# Budget V2 Design Alignment Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the Budget V2 system (section, tabs, and gauges) with the Unified Design System.

**Architecture:**

- Refactor `BudgetsV2Section.tsx` to use `premium-container` and unified headers.
- Refactor `BudgetsV2Tabs.tsx` to align with the canonical tab navigation pattern.
- Refactor `BudgetGauge.tsx` to use `glass-panel`, semantic colors, and premium typography.
- Update `BudgetMonthlyTab.tsx`, `BudgetAnnualTab.tsx`, and `BudgetManageTab.tsx` to use unified grid, card, and table patterns.

**Tech Stack:** React, Tailwind CSS v4, Framer Motion, Lucide Icons.

---

### Task 1: Refactor BudgetsV2Section & Tabs

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsV2Section.tsx`
- Modify: `public/src/components/budgets-v2/BudgetsV2Tabs.tsx`

**Step 1: Align BudgetsV2Section header and layout**
Use `premium-container`. Update header with Activity icon, "Budgets Privés" title, and unified month selector styling (`bg-ink-100`, `border-glass-border`).

**Step 2: Align BudgetsV2Tabs navigation**
Use the `glass` background for the tab bar, `gold` for the active indicator, and label typography (`text-[10px] font-bold uppercase tracking-[0.2em]`).

**Step 3: Commit**

```bash
git add public/src/components/budgets-v2/BudgetsV2Section.tsx public/src/components/budgets-v2/BudgetsV2Tabs.tsx
git commit -m "style: align BudgetsV2Section and Tabs with unified design system"
```

### Task 2: Refactor BudgetGauge (The Core Component)

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetGauge.tsx`

**Step 1: Apply glass-panel and semantic colors**
Use `glass-panel` for the card. Replace custom color logic with `gold`, `amber-400`, and `ruby` based on the budget status.

**Step 2: Update typography**
Use `font-serif` for main amounts (`depense`, `montant`). Use label typography for the budget name and status. Use `tabular-nums` for all figures.

**Step 3: Animate progress bar with Framer Motion**
Replace the CSS transition with `motion.div` as specified in `DESIGN_SYSTEM.md`.

**Step 4: Commit**

```bash
git add public/src/components/budgets-v2/BudgetGauge.tsx
git commit -m "style: align BudgetGauge with unified design system"
```

### Task 3: Refactor Monthly, Annual, and Manage Tab Layouts

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetMonthlyTab.tsx`
- Modify: `public/src/components/budgets-v2/BudgetAnnualTab.tsx`
- Modify: `public/src/components/budgets-v2/BudgetManageTab.tsx`

**Step 1: Align Monthly Tab layout**
Use the design system grid. Update the "Vue Annualisée" button to use the `gold` accent.

**Step 2: Align Annual Tab layout**
Refactor the table to use the `glass-panel` and `DESIGN_SYSTEM.md` table pattern. Use `font-serif` and `tabular-nums` for all monetary values.

**Step 3: Align Manage Tab layout**
Refactor the management table to use the `glass-panel` and unified action buttons.

**Step 4: Verify build**
Run: `npm run build`
Expected: Successful build.

**Step 5: Commit**

```bash
git add public/src/components/budgets-v2/BudgetMonthlyTab.tsx public/src/components/budgets-v2/BudgetAnnualTab.tsx public/src/components/budgets-v2/BudgetManageTab.tsx
git commit -m "style: align Budget V2 tab layouts with unified design system"
```
