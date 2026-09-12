# Design Document: PWA-Optimized Unified Transaction Modals

**Date:** 2026-05-19
**Topic:** UI/UX Harmonization - Transaction Management

## 1. Problem Description

The current transaction detail view in the "Analyse" section is inconsistent with the rest of the application (using specific slide panels instead of modals). Furthermore, the save button in `TransactionFormModal` is located at the bottom of the form, which is impractical in PWA/Mobile mode as it often requires scrolling and can be obscured by system navigation bars or the keyboard.

## 2. Proposed Solution

Unify all transaction interactions under a single, PWA-optimized `TransactionFormModal`. This involves moving the primary "Save" action to the modal header for immediate accessibility and harmonizing the entry points in the "Analyse" section.

## 3. Detailed Changes

### 3.1. Base Component: `Modal.tsx`

- Add a new optional prop `headerActions: React.ReactNode`.
- Render `headerActions` in the top-right corner, to the left of the close button.
- Ensure proper spacing and alignment for touch targets on mobile.

### 3.2. Form Component: `TransactionFormModal.tsx`

- **Action Move:** Move the "Save" (Enregistrer) button from the bottom footer to the `headerActions` of the `Modal`.
- **Styling:** Use a high-contrast style for the header save button (e.g., Gold text or background) to make it the clear primary action.
- **Layout Optimization:** Increase form density to minimize scrolling. Reduce vertical margins between field groups.
- **Footer Cleanup:** The footer will now only contain "Cancel" and "Delete" (if applicable) for better separation of concerns.

### 3.3. View Harmonization: `AnalyseSection.tsx`

- Replace the `AnalyseSlidePanel` drill-down for individual transactions with the standard `TransactionFormModal`.
- Ensure all necessary props (categories, accounts, save/delete handlers) are correctly passed to the modal.

## 4. Implementation Plan

### Step 1: Base Modal Update

- Modify `public/src/components/shared/Modal.tsx` to include `headerActions`.

### Step 2: Transaction Form Refactor

- Update `public/src/components/TransactionFormModal.tsx`.
- Implement header-based saving.
- Refine form density.

### Step 3: Analysis Section Update

- Update `public/src/components/analyse/AnalyseSection.tsx` to use the unified modal.
- Clean up unused specific drill-down logic if no longer needed.

## 5. Verification Strategy

- **Visual Check:** Verify modal header alignment on mobile and desktop breakpoints.
- **Ergonomics:** Confirm "Save" is reachable without scrolling.
- **Functionality:** Test saving and deleting transactions from both the main dashboard and the "Analyse" tab.
- **Regression:** Ensure no other modals using the base `Modal` component are negatively impacted.
