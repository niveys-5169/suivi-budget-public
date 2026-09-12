# Design Document: Refactor Recurring Transaction Detection

**Date:** 2026-05-20
**Topic:** Refactor Detection Logic in `public/src/utils/maths.ts`

## 1. Overview

This document outlines the design for refactoring the recurring transaction detection logic in `public/src/utils/maths.ts`. The primary goal is to move from a rigid, rounding-based grouping to a more flexible, multi-pass approach that considers category, label similarity, and amount variance. Additionally, a temporal filter will be introduced to ensure relevance, and the function signature will be updated for improved testability.

## 2. Refined Transaction Grouping Strategy

The current strict rounding-based signature for grouping recurring transactions will be replaced. A new multi-pass grouping logic will be implemented to identify recurring patterns more flexibly, considering both label similarity and amount variance.

### Details:

1.  **Initial Categorization:** All transactions will first be grouped by their `category`. This step normalizes categories to lowercase and handles uncategorized items (e.g., `(sans catégorie)`). This is consistent with the existing implementation.

2.  **Iterative Sub-grouping within Categories:**
    - Within each category group, transactions will be iterated. For each transaction (`tx`), an attempt will be made to place it into an existing sub-group.
    - **Label Similarity Check:** For a `tx` to be considered for an existing `group`, the average Jaccard similarity (using `computeLabelSimilarity`) between `tx.libelle` and the `libelle` of all `existingTx` within that `group` must be `0.7` or higher.
    - **Amount Variance Check:** If the label similarity criterion is met, the absolute `montant` of `tx` must fall within ±20% of the average absolute `montant` of the `group`.
    - **Group Creation:** If `tx` does not meet the criteria for any existing `group` (i.e., it doesn't satisfy both the average label similarity and amount variance for any existing group), a new `group` will be initialized containing only `tx`.

3.  **Consolidated Groups:** The output of this stage will be a list (`allGroupedTransactions`) of all such identified sub-groups, which are collections of transactions that are similar in category, label, and amount.

## 3. Temporal Filtering and Function Signature Update

To ensure that detected recurring transactions are active and relevant, a temporal filter will be applied. Additionally, the function signature will be updated to allow for easier testing and greater flexibility.

### Details:

1.  **Temporal Filter Implementation:**
    - After the refined transaction grouping, each candidate group (from `allGroupedTransactions`) will undergo a temporal filtering step.
    - A group must contain at least **3 transactions** that occurred within the last **180 days** relative to a specified `referenceDate`.
    - Groups failing this criterion (i.e., having fewer than 3 recent transactions) will be discarded. This ensures that only currently active or recently active recurring patterns are considered for final output.

2.  **Function Signature Update:**
    - The `detectRecurringTransactionsPure` function signature will be modified to accept an optional `referenceDate` parameter.
    - `referenceDate: Date = new Date()`: This parameter will default to the current date when not provided, allowing the function to behave as it currently does in production. However, it provides the flexibility to specify a different date for testing purposes, which is crucial for reliably testing time-dependent logic.

## 4. Example (Refer to `docs/plans/2026-05-20-grouping-strategy-example.md`)

A detailed example illustrating the refined transaction grouping strategy can be found in `docs/plans/2026-05-20-grouping-strategy-example.md`. This example demonstrates how transactions are processed through the label similarity and amount variance checks to form distinct sub-groups.
