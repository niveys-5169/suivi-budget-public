# Design Document: Fix Budget Income Tracking & Agnostic Cash Flow

**Date:** 2026-05-18
**Topic:** Budget Management - Agnostic Cash Flow Calculation

## 1. Problem Description

Currently, the budget view only adds inflows (positive transactions) to the "Total Income" (Encaissé) KPI if the category is classified as "Income". Inflows in "Expense" categories (like CAF if misconfigured, or refunds) are ignored in the global income total, leading to inaccurate financial overview.

## 2. Proposed Approach: Agnostic Cash Flow

We will move away from category-based global totals to transaction-based global totals.

### Core Logic Changes

In `BankinBudgetsContainer.tsx`, we will refactor the aggregation logic:

1.  **Global KPIs (The "Truth"):**
    - `totalReceived` = Sum of all positive amounts (`> 0`) from ALL transactions in the current scope.
    - `totalSpent` = Sum of all negative amounts (`< 0`) from ALL transactions in the current scope.
    - `netBalance` = `totalReceived - totalSpent`.
    - _Result:_ Every euro received, regardless of category, increases the global "Income" KPI.

2.  **Category Classification (The "Display"):**
    - A category's position (Income grid vs Expense grid) is determined by:
      1. User configuration (Budget type = 'revenu').
      2. Configuration RAV (`revenu_categories`).
      3. Automatic detection (Historical majority of credits).
    - _Agnostic nature:_ A category placed in "Expenses" can still contribute to the global "Income" total if it receives money.

3.  **Category Metrics (The "Usage"):**
    - For each category tile:
      - `spent` = The net impact on that category (Sum of all transactions in that category).
      - If it's an Expense category: Displayed as `Math.max(0, -netAmount)`.
      - If it's an Income category: Displayed as `Math.max(0, netAmount)`.

## 3. Technical Implementation

- **File:** `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`
- **Refactor:** Update the `allCategoryNames.forEach` loop to accumulate `totalReceived` and `totalSpent` from every transaction encounter, before any category-level classification logic.

## 4. Success Criteria

- [x] CAF inflows are visible in the global "Encaissé" total.
- [x] Refunds in expense categories increase "Encaissé" instead of just hiding inside "Spent".
- [x] "Solde Net" is mathematically consistent with the bank reality.
- [x] User can still see CAF in the "Expenses" list if they prefer it there, without breaking the math.

## 5. Risk Assessment

- **UI Perception:** The "Total Spent" might appear higher because refunds no longer "mask" gross expenses in the global KPI. _Mitigation:_ This is more transparent and matches standard accounting.
