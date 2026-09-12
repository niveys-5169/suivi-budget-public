# Transactions Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Migrate legacy transaction filtering, listing, and modal logic from `app.js` and `transactions.js` into modular React components and hooks.

**Architecture:**

- **Hooks:** `useTransactions.tsx` for state and data fetching.
- **Components:** `TransactionFilters.tsx` for UI, `TransactionFormModal.tsx` for add/edit.
- **Integration:** Hybrid React mounting in `app.js` replacing legacy `renderTable`, `renderCards`, and legacy modals.

**Tech Stack:** React, TypeScript, Vite, Firebase Firestore.

---

### Task 1: Create useTransactions Custom Hook

**Files:**

- Create: `public/src/hooks/useTransactions.tsx`

- [x] **Step 1: Implement useTransactions hook**
  - Should handle:
    - Data fetching with `onSnapshot` from `transactions`.
    - Local state for filters (`search`, `compte`, `type`, `year`, `month`, `pointe`, `categorie`).
    - Derived state for `filteredTransactions`.
    - CRUD actions: `togglePointe`, `deleteTransaction`, `saveTransaction`.

- [x] **Step 2: Commit hook implementation**

### Task 2: Create TransactionFilters React Component

**Files:**

- Create: `public/src/components/TransactionFilters.tsx`

- [x] **Step 1: Implement TransactionFilters component**
  - Should include all existing filters from `app.js`/`index.html`:
    - Search text.
    - Compte dropdown.
    - Type dropdown.
    - Year & Month dropdowns.
    - Status (Pointe) dropdown.
    - Categorie dropdown.
    - Buttons for "Reset" and "Point all/Unpoint all" if applicable.

- [x] **Step 2: Commit component implementation**

### Task 3: Create TransactionFormModal React Component

**Files:**

- Create: `public/src/components/TransactionFormModal.tsx`

- [x] **Step 1: Implement TransactionFormModal component**
  - Should handle both "Add" and "Edit" modes.
  - Form fields: date, libelle, montant, compte, categorie, commentaire, pointe.
  - Validation logic.

- [x] **Step 2: Commit component implementation**

### Task 4: Create TransactionsSection Container & Hybrid Integration

**Files:**

- Create: `public/src/components/TransactionsSection.tsx`
- Modify: `public/src/app.js`
- Modify: `public/index.html`

- [x] **Step 1: Create TransactionsSection component to orchestrate Filters, Table, and Modal**
- [x] **Step 2: Update index.html to provide a single mount point for the transactions section**
  - Replace legacy filter bar and table container with `<div id="transactions-root"></div>`.
- [x] **Step 3: Update app.js to mount TransactionsSection**
  - Replace `applyFilters`, `renderTable`, `renderCards` with React rendering.
  - Expose any necessary global handlers for legacy parts if still needed.

- [x] **Step 4: Commit integration**
