# iOS PWA Safe Area UI Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix UI overlaps on iOS PWA by implementing dynamic safe area paddings and margins for all Dashboard v2 components.

**Architecture:** Utilize CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` within Tailwind arbitrary values to ensure the UI respects the iPhone's notch and home indicator.

**Tech Stack:** React, Tailwind CSS.

---

### Task 1: Update Top Navigation Padding (Standard Pages)

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumAIPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumAccountDetailPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumBudgetPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumDashboard.tsx`
- Modify: `public/src/components/dashboard/v2/AurumInsightsPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumNotificationPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumProfilePage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumRecurringPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumRulesPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumSettingsPage.tsx`
- Modify: `public/src/components/dashboard/v2/AurumWealthPage.tsx`

- [ ] **Step 1: Replace `pt-14` with `pt-[calc(env(safe-area-inset-top)+1.5rem)]`** in all `<nav>` or main header containers.
- [ ] **Step 2: Commit**

```bash
git add public/src/components/dashboard/v2/
git commit -m "fix(ui): dynamic top safe area padding for dashboard pages"
```

### Task 2: Fix AurumTransactionsPage.tsx Layout

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`

- [ ] **Step 1: Update main header padding**: Replace `pt-14` with `pt-[calc(env(safe-area-inset-top)+1.5rem)]`.
- [ ] **Step 2: Fix horizontal padding**: Change `px-12` (mobile) to `px-7`.
- [ ] **Step 3: Update sticky date headers**: Find `top-[100px]` and change to `top-[calc(env(safe-area-inset-top)+64px)]`.
- [ ] **Step 4: Update search island bottom clearance**: Add `bottom-[calc(2rem+env(safe-area-inset-bottom))]` if needed (check existing).
- [ ] **Step 5: Commit**

```bash
git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx
git commit -m "fix(ui): transactions page safe area and padding alignment"
```

### Task 3: Fix Bottom Navigation in AurumDashboard.tsx

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumDashboard.tsx`

- [ ] **Step 1: Update bottom nav height and padding**:
  - Change `h-20` to `h-[calc(5rem+env(safe-area-inset-bottom))]`.
  - Add `pb-[env(safe-area-inset-bottom)]`.
- [ ] **Step 2: Commit**

```bash
git add public/src/components/dashboard/v2/AurumDashboard.tsx
git commit -m "fix(ui): bottom navigation safe area inset"
```

### Task 4: Fix Floating Elements Clearance (AI Page)

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumAIPage.tsx`

- [ ] **Step 1: Update input area bottom clearance**: Change `bottom-8` or similar to `bottom-[calc(2rem+env(safe-area-inset-bottom))]`.
- [ ] **Step 2: Commit**

```bash
git add public/src/components/dashboard/v2/AurumAIPage.tsx
git commit -m "fix(ui): AI input area bottom safe area clearance"
```

### Task 5: Final Verification and Cleanup

- [ ] **Step 1: Global audit for `pt-14` or `pb-8`** that might still be causing issues in dashboard v2.
- [ ] **Step 2: Verify `AurumSettingsPage.tsx`** sticky header.
- [ ] **Step 3: Commit**

```bash
git commit -m "fix(ui): final safe area alignment and cleanup"
```
