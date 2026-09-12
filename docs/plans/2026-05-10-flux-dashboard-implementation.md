# FLUX Dashboard Redesign Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the `AurumTransactionsPage` into a high-end "FLUX" stream with anti-overlap spacing and hybrid priority rows.

**Architecture:** Use a timeline-based grouping (day-clusters) with sticky headers. Implement a rigid vertical rhythm with 24px/12px spacing rules. Row components use a two-line hybrid layout for metadata.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons.

---

### Task 1: Setup Layout Skeleton & Spacing

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`

**Step 1: Update main container and background**
Replace the current layout with the solid `#0B0B14` background and the ambient glows defined in the design.

**Step 2: Implement Day-Cluster grouping logic**
Modify the rendering logic to group `filteredTransactions` by date before mapping.

**Step 3: Add Spacing & Sticky Headers**
Apply `gap-y-6` between clusters and `sticky top-[80px]` to the date headers.

**Step 4: Commit**

```bash
git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx
git commit -m "feat(flux): setup layout skeleton and timeline grouping"
```

---

### Task 2: Redesign Transaction Row (The "Hybrid" Row)

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx` (Inline component or separate if needed)

**Step 1: Update Row Geometry & Surface**
Set `min-height: 84px`, `p-5`, and use `glass-panel` classes.

**Step 2: Implement Left Block (Metadata)**
Add the 48x48px icon container and the two-line text stack (Label + Sub-line for Category/Account).

**Step 3: Implement Right Block (Financial)**
Apply `font-serif text-[17px] font-bold` to the amount. Add the 65% max-width constraint to the left block for anti-overflow.

**Step 4: Apply Color Logic**
Set Inflows to Gold (`#D4AF37`) and Outflows to Platinum (`#EDEDED`).

**Step 5: Commit**

```bash
git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx
git commit -m "feat(flux): implement hybrid priority transaction row"
```

---

### Task 3: Interactivity & Animations

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`

**Step 1: Add Hover Effects**
Update the row's `motion.div` with the lift (`y: -2px`) and background shift.

**Step 2: Implement Entry Sequence**
Wrap the transaction list in an `AnimatePresence` and use staggered `variants` for the entry flow.

**Step 3: Configure Spring Physics**
Set `stiffness: 100` and `damping: 20` for all motion transitions.

**Step 4: Commit**

```bash
git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx
git commit -m "feat(flux): add premium interactivity and staggered entry animations"
```

---

### Task 4: Floating Search Island & Navigation Safety

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`

**Step 1: Reposition Search Bar**
Move the search input to a fixed bottom-8 "Island" with `backdrop-blur-2xl` and `max-width: 600px`.

**Step 2: Add Navigation Safety Padding**
Add `pb-32` to the main `<main>` container to ensure scroll clearance.

**Step 3: Final Visual Polish**
Verify WCAG AA contrast and "No-Fly Zone" buffer on large screens.

**Step 4: Commit**

```bash
git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx
git commit -m "feat(flux): move search to bottom island and final visual polish"
```
