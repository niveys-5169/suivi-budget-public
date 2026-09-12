# Design Doc: Fix Budget Display in Budget Tab

**Date:** 2026-05-11

**Author:** Cline

## 1. Overview

The budget is not being displayed in the budget tab. The "BUDGET TOTAL" is shown as 0,00 €. This is because the incorrect variable is being passed to the `BankinBudgetMain` component.

## 2. Problem

The `BankinBudgetsContainer.tsx` component is responsible for calculating and displaying the budget data. It correctly calculates `totalExpenseBudget`, which is the sum of all expense budgets. However, it passes `totalIncomeBudget` to the `totalBudget` prop of the `BankinBudgetMain` component.

The `BankinBudgetMain` component is designed to display the expense budget. Its internal logic for calculating the remaining budget and progress bar is based on the assumption that the `totalBudget` prop represents the total expense budget.

This discrepancy leads to the "BUDGET TOTAL" being displayed as 0,00 €, as there are likely no income budgets defined.

## 3. Proposed Solution

The solution is to pass the correct variable, `totalExpenseBudget`, to the `totalBudget` prop of the `BankinBudgetMain` component.

This change will be made in `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`.

**File to modify:** `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`

**Change:**

- **Line 312:** Change `totalBudget={budgetData.totalIncomeBudget}` to `totalBudget={budgetData.totalExpenseBudget}`.

## 4. Rationale

This change aligns the code with the intended functionality of the `BankinBudgetMain` component and the overall design of the budget view, which is focused on expense management. The component's prop documentation and internal logic, as well as the UI text "Maîtrise des dépenses", all support this change.

## 5. Implementation Plan

1.  Use `replace_in_file` to modify `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`.
2.  Verify the fix by running the application and checking the budget tab.

## 6. Test Plan

- **Manual Testing:**
  1.  Run the application.
  2.  Navigate to the budget tab.
  3.  Verify that the "BUDGET TOTAL" is no longer 0,00 € and displays the correct total expense budget.
  4.  Verify that the progress bar and "RESTANT" (remaining) values are calculated correctly based on the total expense budget.

- **Automated Testing:**
  - No new automated tests are required for this change, as it is a fix to an existing component's data flow. Existing tests should continue to pass.
