# Dashboard React Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Dashboard React migration by replacing legacy HTML with a React root and updating the bridge in `app.js`.

**Architecture:**

- **Entry Point:** `DashboardSection.tsx` mounted into `#dashboard-root`.
- **Bridge:** `app.js`'s `renderDashboard` function repurposed as a React renderer.
- **Cleanup:** Removal of ~150 lines of redundant HTML from `index.html`.

**Tech Stack:** React, TypeScript, Vite.

---

### Task 1: Prepare index.html for React Mounting

**Files:**

- Modify: `public/index.html`

- [ ] **Step 1: Locate and remove legacy dashboard content**
  - Search for `<div id="tab-dashboard" class="panel">`.
  - Delete everything inside it (from `dashboard-period-bar` to `compare-section`).
- [ ] **Step 2: Insert the React root div**
  - Add `<div id="dashboard-root"></div>` inside `#tab-dashboard`.
  - Add a fallback loading message for better UX.

```html
<div id="tab-dashboard" class="panel">
  <div id="dashboard-root">
    <div style="padding:40px; text-align:center; color:var(--muted)">
      <div class="spinner" style="margin:0 auto 20px"></div>
      Chargement du Dashboard...
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit HTML changes**
  - `git add public/index.html`
  - `git commit -m "refactor: replace legacy dashboard HTML with React root"`

### Task 2: Update app.js Bridge Logic

**Files:**

- Modify: `public/src/app.js`

- [ ] **Step 1: Import React dependencies and DashboardSection**
  - Note: `app.js` uses global `React` and `createRoot` via Vite's auto-import or standard globals if configured.
  - Verify if `DashboardSection` is available globally or needs import (it's likely imported in `main.js` or through a bridge).
- [ ] **Step 2: Redefine renderDashboard function**
  - Replace the 60+ lines of DOM manipulation with a React render call.

```javascript
// At the top of app.js (or near other root definitions)
let dashboardRoot = null;

// Replace existing renderDashboard
function renderDashboard() {
  const box = document.getElementById('dashboard-root');
  if (!box) return;

  if (!dashboardRoot) {
    // Import createRoot if not available globally
    const { createRoot } = window.ReactDOM || {};
    if (typeof createRoot === 'function') {
      dashboardRoot = createRoot(box);
    } else {
      console.error('React createRoot not found');
      return;
    }
  }

  // Import/Reference DashboardSection (assuming it's exported and bundled)
  // Since this is a hybrid app, we might need to use a window-level reference
  // if not using a clean module import yet.
  if (window.DashboardSection) {
    dashboardRoot.render(React.createElement(window.DashboardSection));
  } else {
    // Fallback if not on window yet
    import('./components/DashboardSection').then((mod) => {
      window.DashboardSection = mod.DashboardSection;
      dashboardRoot.render(React.createElement(mod.DashboardSection));
    });
  }
}
```

- [ ] **Step 3: Commit app.js changes**
  - `git add public/src/app.js`
  - `git commit -m "feat: bridge legacy renderDashboard to React DashboardSection"`

### Task 3: Expose React Components to Global Scope (if needed)

**Files:**

- Modify: `public/src/main.js`

- [ ] **Step 1: Export DashboardSection to window**
  - Ensure the hybrid `app.js` can see the React component.

```javascript
import { DashboardSection } from './components/DashboardSection';
window.DashboardSection = DashboardSection;
```

- [ ] **Step 2: Commit main.js changes**

### Task 4: Verification & Final Polish

- [ ] **Step 1: Run dev server**
  - `npm run dev`
- [ ] **Step 2: Manual verification**
  - Check tab switching to "Dashboard".
  - Verify KPIs (Solde, Recettes, Dépenses) match legacy values.
  - Verify Period switching (Mois, Année) works.
  - Verify Reste à Vivre progress bar.
- [ ] **Step 3: Check Console for Errors**
  - Ensure no React warnings or missing global references.
