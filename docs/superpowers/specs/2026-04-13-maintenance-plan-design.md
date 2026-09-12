# Design Spec: Maintenance Plan & Application Review

**Date:** 2026-04-13
**Author:** Gemini CLI

## 1. Overview

This document outlines the plan for a complete application review, documentation rewrite, and a maintenance simplification strategy for the Suivi-Budget project. The primary focus is on reducing technical debt in the frontend while ensuring business rules remain unchanged.

## 2. Goals

- **Architectural Clarity:** Provide a clear map of the hybrid (Apps Script + Firebase) system.
- **Frontend Maintainability:** Transition from monolithic Vanilla JS files to a modular React-based architecture.
- **Logic Consolidation:** Unify bank email parsing logic to prevent duplication and drift.
- **Improved Documentation:** Create a comprehensive, single-source-of-truth `README.md`.

## 3. Review Summary

### 3.1 Frontend

- **Current State:** `app.js` and `patrimoine.js` are large monoliths (4000+ and 1800+ lines respectively). Manual DOM manipulation via `innerHTML` is pervasive.
- **Issues:** High risk of regression during UI changes, difficult to test, and steep learning curve for new developers.
- **Improvement:** Adopt a component-based architecture using React/TSX.

### 3.2 Backend & Data Flow

- **Current State:** Parsing logic for Linxo emails is duplicated in Apps Script (JS) and Firebase Functions (Python).
- **Issues:** Double maintenance effort for email format changes.
- **Improvement:** Designate Firebase Functions as the primary parsing engine and have Apps Script consume its output if possible.

## 4. Maintenance Plan: Gradual React Migration

### 4.1 Componentization

- Break down `public/src/app.js` into functional components:
  - `TransactionTable.tsx` (existing)
  - `BalanceCard.tsx`
  - `FilterBar.tsx`
  - `Header.tsx`
- Break down `public/src/patrimoine.js` into:
  - `PlacementTable.tsx` (existing)
  - `AssetDistributionChart.tsx`
  - `PatrimoineSummary.tsx`

### 4.2 State & Data Management

- Move Firestore fetching and local state to Custom Hooks:
  - `useTransactions()`: Filtering, fetching, and updating transactions.
  - `useBalances()`: Real-time account balance tracking.
- Use `Zustand` or React `Context` for global UI state (current tab, global filters).

### 4.3 Service Layer Refactoring

- Consolidate all Firebase interactions in `public/src/services/firebase.ts`.
- Decouple UI components from the database structure.

## 5. Documentation Rewrite Strategy

A new comprehensive `README.md` will be created with the following structure:

1. **Introduction & Value Proposition**
2. **System Architecture Diagram** (Mermaid or detailed text)
3. **Core Components:**
   - Gmail Parsing (Linxo)
   - Firestore Storage Schema
   - Frontend (React + Vite)
   - Apps Script Integration
4. **Development Guide:**
   - Local Setup (Python venv, npm)
   - Secrets Management (GitHub Secrets, .env)
   - Deployment (Firebase Hosting, Functions)
5. **Maintenance Manual:**
   - How to update parsing rules.
   - How to add new account types.
6. **Troubleshooting & FAQ**

## 6. Constraints & Safety

- **No Business Rule Changes:** All parsing logic, categorization rules, and calculation formulas must be preserved exactly as they are.
- **Incremental Implementation:** Changes should be made in small, verifiable steps to avoid breaking the daily import pipeline.
- **Testing:** New React components must be verified against current UI behavior.

## 7. Next Steps

1. User approval of this design spec.
2. Creation of a detailed implementation plan using the `writing-plans` skill.
3. Execution of the plan in phased iterations.
