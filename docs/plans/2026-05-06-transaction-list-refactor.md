# Transaction List Refactor (Aurum Flux) Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the transaction display into a grouped card-based list that matches the "Flux.PNG" layout while strictly maintaining Aurum's Gold & Ink color system and existing business logic.

**Architecture:** We will replace the legacy `TransactionsTable` with a new `TransactionGroupedList` component. This component will handle date-based grouping and daily total calculations. We will leverage existing styles from `transactions.js` and `DESIGN_SYSTEM.md`.

**Tech Stack:** React, Tailwind CSS, Framer Motion (for swipe actions), Lucide Icons.

---

### Task 1: Create the Transaction Grouped List Component

**Files:**

- Create: `public/src/components/transactions/TransactionGroupedList.tsx`
- Modify: `public/src/components/TransactionsSection.tsx`

**Step 1: Implement Grouping and Totaling Logic**
Create the base component that takes transactions as props and groups them by date, calculating the sum for each day.

**Step 2: Define the Card Component (Internal)**
Create a `TransactionCard` component (within the same file) that matches the layout of `Flux.PNG`:

- Large circular icon on the left (44-48px).
- Bold title (libellé) and category/account subtitle in the middle.
- Large amount on the right (font-serif).
- Opacity reduction (50%) for pointed transactions.

**Step 3: Implement Swipe-to-Point**
Port the `framer-motion` drag logic from `TransactionsTable.tsx` to the new card component to maintain the swipe gesture.

**Step 4: Update TransactionsSection.tsx**
Replace the `<table>` structure and `TransactionsTable` call with the new `TransactionGroupedList`.

---

### Task 2: Refine Aesthetics & Polish

**Files:**

- Modify: `public/src/components/transactions/TransactionGroupedList.tsx`
- Modify: `public/src/components/TransactionsSection.tsx`

**Step 1: Sticky Header Implementation**
Ensure the date headers (`Hier`, `Aujourd'hui`, etc.) are sticky and have a backdrop blur effect that matches the Aurum design system.

**Step 2: Maintain Existing Category Icons/Colors**
Ensure `getCatStyle` from `transactions.js` is used to source the correct SVGs and brand colors for the icons.

**Step 3: Validation & Mobile View Check**
Verify that the layout is responsive and that amounts remain perfectly visible on smaller screens as requested.

---

### Task 3: Verification & Cleanup

**Step 1: Functional Testing**

- Verify that clicking a transaction opens the edit modal.
- Verify that swiping/pointing updates the state correctly.
- Verify that filters still work as expected with the new list view.

**Step 2: Code Review & Cleanup**
Remove any unused code from the old table implementation if no longer needed.
