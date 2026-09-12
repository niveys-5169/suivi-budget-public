# Design Spec: Dashboard React Migration & Code Cleanup

**Date:** 2026-04-15
**Status:** Draft
**Topic:** Dashboard Modernization (Step 3) and Cleanup (Steps 1 & 2)

## 1. Objective

Complete the modernization of the "Dashboard" section by fully migrating it to React, removing legacy HTML, and starting the logical separation of `app.js`.

## 2. Architecture

- **Root Component:** `DashboardSection.tsx` will act as the single entry point for the Dashboard panel.
- **Mount Point:** A single `<div id="dashboard-root"></div>` inside `#tab-dashboard` in `index.html`.
- **Logic:** All calculation logic (KPIs, RAV, filtering) will be handled by the `useDashboard()` hook.
- **Legacy Bridge:** `renderDashboard()` in `app.js` will be converted to a simple React render call.

## 3. Phased Approach

### Phase A: Dashboard React Switch (The "Clean Switch")

1.  **HTML Cleanup:**
    - Remove all children of `<div id="tab-dashboard">` in `index.html`.
    - Insert `<div id="dashboard-root"></div>`.
2.  **App.js Bridge:**
    - Modify `renderDashboard()` to mount `DashboardSection` via `createRoot`.
    - Ensure `scrollToPanel('dashboard')` triggers this render.
3.  **Validation:**
    - Verify that Period Navigation, KPIs, and RAV are working correctly in the new UI.

### Phase B: Logical Separation & Cleanup

1.  **Refactor `app.js`:**
    - Mark legacy calculation functions (e.g., `dashboardFilteredTransactions`, `getRecurringProvisions`) as deprecated.
    - Move shared business logic to `public/src/utils` or `public/src/services`.
2.  **Unused Code Removal:**
    - Remove `setText` calls for dashboard elements that no longer exist in `index.html`.
    - Delete legacy CSS specifically targeting removed dashboard IDs.

## 4. Success Criteria

- The Dashboard tab displays identical or improved functionality compared to the legacy version.
- `index.html` is significantly reduced in size (removal of ~150 lines).
- `app.js` no longer performs manual DOM updates for the Dashboard section.

## 5. Rollback Plan

- Revert changes to `index.html` and `app.js` to restore legacy rendering.
- Legacy logic remains in `app.js` during Phase A to ensure no data loss.
