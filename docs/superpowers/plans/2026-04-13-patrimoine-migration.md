# Patrimoine Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrate legacy placement management, asset tracking, and owner mapping logic from `patrimoine.js` into modular React components and hooks.

**Architecture:**

- **Hooks:** `usePatrimoine.tsx` for state (placements, savings, portfolio, mapping) and Firestore CRUD.
- **Components:** `PatrimoineSummary.tsx`, `CourantsTable.tsx`, `PatrimoineCharts.tsx`, `OwnerMappingSection.tsx`.
- **Integration:** Hybrid React mounting in `app.js` replacing `renderPatrimoine` and `initPatrimoineModule`.

**Tech Stack:** React, TypeScript, Vite, Firebase (dual projects), Chart.js.

---

### Task 1: Create usePatrimoine Custom Hook

**Files:**

- Create: `public/src/hooks/usePatrimoine.tsx`

- [x] **Step 1: Implement usePatrimoine hook**
  - Should handle:
    - Real-time fetching of `placements` and `savings_balances`.
    - Fetching `patrimoine_settings` (portfolio value fallback).
    - Loading `account_owners_mapping` configuration.
    - Integration with the second Firebase project for live portfolio holdings.
    - CRUD actions for placements.
    - Logic for computing totals and owner distributions.

- [x] **Step 2: Commit hook implementation**

### Task 2: Create Patrimoine UI Components (Tables & Summary)

**Files:**

- Create: `public/src/components/CourantsTable.tsx`
- Create: `public/src/components/PatrimoineSummary.tsx`
- Modify: `public/src/components/PlacementsTable.tsx` (if needed for hook integration)

- [x] **Step 1: Implement CourantsTable component**
- [x] **Step 2: Implement PatrimoineSummary component**
- [x] **Step 3: Update PlacementsTable to use usePatrimoine hook**
- [x] **Step 4: Commit components**

### Task 3: Create PatrimoineCharts & OwnerMapping Components

**Files:**

- Create: `public/src/components/PatrimoineCharts.tsx`
- Create: `public/src/components/OwnerMappingSection.tsx`

- [x] **Step 1: Implement PatrimoineCharts component (wrapping Chart.js)**
- [x] **Step 2: Implement OwnerMappingSection component (replacing legacy modal logic)**
- [x] **Step 3: Commit components**

### Task 4: Create PatrimoineSection Container & Hybrid Integration

**Files:**

- Create: `public/src/components/PatrimoineSection.tsx`
- Modify: `public/src/app.js`
- Modify: `public/index.html`

- [x] **Step 1: Create PatrimoineSection container to orchestrate the UI**
- [x] **Step 2: Update index.html to provide mount points for the patrimoine section**
- [x] **Step 3: Update app.js to mount PatrimoineSection and remove patrimoine.js dependency**
- [x] **Step 4: Commit integration**
