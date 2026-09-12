# Maintenance & Zero Warning Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up linting warnings, fix security vulnerabilities, and adjust E2E test frequency.

**Architecture:** Systematic cleanup of ESLint warnings, dependency updates for Python, and GitHub Actions configuration update.

**Tech Stack:** ESLint, Python (pip-audit), GitHub Actions.

---

### Task 1: Update E2E Smoke Test Frequency

**Files:**

- Modify: `.github/workflows/e2e.yml`

- [ ] **Step 1: Update cron schedule**

Change the cron from `'30 3 * * *'` to `'30 3 * * 0'` (Sunday at 3:30 AM).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: run E2E smoke tests once a week on Sunday"
```

---

### Task 2: Fix Security Vulnerabilities in Python Dependencies

**Files:**

- Modify: `requirements.txt`
- Modify: `functions/requirements.txt`

- [ ] **Step 1: Upgrade PyJWT and Flask-CORS**

In `requirements.txt`, update `PyJWT` to `2.12.1`.
In `functions/requirements.txt`, add `PyJWT==2.12.1` and `Flask-CORS==5.0.0` explicitly to ensure they are updated.

- [ ] **Step 2: Run pip-audit to verify**

Run: `python -m pip_audit -r requirements.txt`
Expected: No vulnerabilities.
Run: `python -m pip_audit -r functions/requirements.txt`
Expected: No vulnerabilities.

- [ ] **Step 3: Commit**

```bash
git add requirements.txt functions/requirements.txt
git commit -m "fix(security): upgrade PyJWT and Flask-CORS to resolve vulnerabilities"
```

---

### Task 3: Fix ESLint Warnings in `AdvancedSettings.tsx`

**Files:**

- Modify: `public/src/components/AdvancedSettings.tsx`

- [ ] **Step 1: Replace `any` with specific types or `unknown`**

Identify the `any` types around lines 308-309 and replace them with `unknown` or a better type if obvious.

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: Fewer warnings.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/AdvancedSettings.tsx
git commit -m "fix(lint): remove 'any' in AdvancedSettings.tsx"
```

---

### Task 4: Fix Remaining ESLint Warnings

**Files:**

- Modify: multiple files in `public/src/`

- [ ] **Step 1: Fix `any` in `BankinBudgetMain.tsx`, `BudgetsPage.tsx`, etc.**

Systematically go through the lint report and fix the `any` warnings.

- [ ] **Step 2: Remove unused variables in `store.d.ts`**

- [ ] **Step 3: Fix empty interfaces in `balances.ts`**

- [ ] **Step 4: Verify lint passes with zero warnings**

Run: `npm run lint`
Expected: `✖ 0 problems (0 errors, 0 warnings)`

- [ ] **Step 5: Commit**

```bash
git add public/src/
git commit -m "fix(lint): resolve all remaining ESLint warnings"
```

---

### Task 5: Fix Annual Budget Consumption and YTD Vision

**Files:**

- Modify: `public/src/components/budgets-v2/BudgetsPage.tsx`
- Modify: `public/src/components/budgets-v2/BankinBudgetMain.tsx`
- Modify: `public/src/components/budgets-v2/BankinBudgetGrid.tsx`

- [ ] **Step 1: Update `BudgetsPage.tsx` to override budget period**

In `consumptionData` useMemo, pass a modified budget object to `computeConsumption` with `periode.type` set to `annee_civile` if `budgetPeriodMode === 'year'`.

- [ ] **Step 2: Update `BankinBudgetMain.tsx` to support annual view**

Add `viewMode` to props and adjust labels and chart logic to handle year-wide data.

- [ ] **Step 3: Update `BankinBudgetGrid.tsx` sparkline for annual view**

Adjust the grouping logic to group by month if `periodeDebut` and `periodeFin` span more than 31 days.

- [ ] **Step 4: Verify yearly vision**

Switch to Annual mode in UI and check if total spent and category breakdown reflect the whole year.

- [ ] **Step 5: Commit**

```bash
git add public/src/components/budgets-v2/
git commit -m "feat(budget): fully implement annual budget and YTD vision"
```
