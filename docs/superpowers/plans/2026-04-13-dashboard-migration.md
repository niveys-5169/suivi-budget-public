# Dashboard KPIs Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrate legacy dashboard metrics, period navigation, and "Reste à vivre" logic from `app.js` into modular React components and hooks.

**Architecture:**

- **Hooks:** `useDashboard.tsx` for state (period, month, categories) and filtering logic.
- **Components:** `HeroKPIs.tsx`, `DashboardNavigation.tsx`, `RAVPanel.tsx`, `RecentOperations.tsx`, `CategoryFilterChips.tsx`.
- **Integration:** Hybrid React mounting in `app.js` replacing `renderDashboard` internals.

**Tech Stack:** React, TypeScript, Vite, Chart.js (legacy bridge).

---

### Task 1: Create useDashboard Custom Hook

**Files:**

- Create: `public/src/hooks/useDashboard.tsx`

- [x] **Step 1: Implement useDashboard hook**
  - Should handle:
    - State for `period` (current_month, year_to_date, last_year, custom, all_time).
    - State for `monthKey` (YYYY-MM).
    - State for `customRange` (start, end).
    - State for `selectedCategories` (Set of strings).
    - Logic for `dashboardFilteredTransactions` based on `useTransactions` data.
    - Persistence to `localStorage` for categories.

- [x] **Step 2: Commit hook implementation**

### Task 2: Create Dashboard UI Components (Hero & Nav)

**Files:**

- Create: `public/src/components/HeroKPIs.tsx`
- Create: `public/src/components/DashboardNavigation.tsx`
- Create: `public/src/components/CategoryFilterChips.tsx`

- [x] **Step 1: Implement HeroKPIs component**
- [x] **Step 2: Implement DashboardNavigation component**
- [x] **Step 3: Implement CategoryFilterChips component**
- [x] **Step 4: Commit components**

### Task 3: Create RAVPanel & RecentOperations Components

**Files:**

- Create: `public/src/components/RAVPanel.tsx`
- Create: `public/src/components/RecentOperations.tsx`

- [x] **Step 1: Implement RAVPanel component (with RAV calculation logic)**
- [x] **Step 2: Implement RecentOperations component**
- [x] **Step 3: Commit components**

### Task 4: Create DashboardSection Container & Hybrid Integration

**Files:**

- Create: `public/src/components/DashboardSection.tsx`
- Modify: `public/src/app.js`
- Modify: `public/index.html`

- [x] **Step 1: Create DashboardSection component to orchestrate the dashboard UI**
- [x] **Step 2: Update index.html to provide mount points for dashboard sections**
- [x] **Step 3: Update app.js to mount DashboardSection and bridge with legacy charts**
- [x] **Step 4: Commit integration**
