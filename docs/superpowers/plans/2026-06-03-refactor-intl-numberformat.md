# Refactorisation des allocations Intl.NumberFormat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize and cache all `Intl.NumberFormat` instances in the application to prevent memory leaks and slow-downs during UI transitions and animations.

**Architecture:** Update `public/src/lib/formatters.ts` with a generic cache-backed `getFormatter` and update `formatCurrency`. Then replace all inline usages across 30+ files in both desktop and mobile layouts.

**Tech Stack:** React 18, TypeScript, Vitest, Tailwind CSS.

---

### Task 1: Update formatters helper in `public/src/lib/formatters.ts`

**Files:**

- Modify: `public/src/lib/formatters.ts`
- Test: `public/src/lib/__tests__/formatters.test.ts`
- Test: `tests/utils/premium_formatters.test.ts`

- [ ] **Step 1: Write additional tests for new formatter cache and options support**

In `public/src/lib/__tests__/formatters.test.ts`, add a test block:

```typescript
it('supports custom formatting options and caches the formatter', () => {
  const val = 1234.567;
  const resCompact = formatCurrency(val, 'EUR', 'fr-FR', { notation: 'compact' });
  // "1,2 k €" or similar depending on the environment
  expect(resCompact).toBeDefined();

  const resNoDecimals = formatCurrency(val, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });
  expect(resNoDecimals.replace(/\u202f|\u00a0/g, ' ')).toMatch(/1 235 €/);
});
```

- [ ] **Step 2: Run tests to verify the new test fails or compiles fails due to signature differences**

Run: `npm test public/src/lib/__tests__/formatters.test.ts -- --run`
Expected: FAIL/Compile error

- [ ] **Step 3: Update `public/src/lib/formatters.ts` implementation**

Replace current implementation of `formatterCache`, `getFormatter`, and `formatCurrency` with:

```typescript
const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const optionsKey = Object.keys(options)
    .sort()
    .map((k) => `${k}:${(options as any)[k]}`)
    .join('|');
  const key = `${locale}-${optionsKey}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
};

export const formatCurrency = (
  amount: number,
  currency: Currency = 'EUR',
  locale: string = 'fr-FR',
  options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {},
): string => {
  return getFormatter(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
};
```

- [ ] **Step 4: Run tests to verify all formatting tests pass**

Run: `npm test public/src/lib/__tests__/formatters.test.ts -- --run`
Expected: PASS

- [ ] **Step 5: Commit**

Propose commit: `perf: update formatCurrency helper to support custom options and caching`

---

### Task 2: Refactor inline formatters in target components and files

**Files:**

- Modify all 30 target files:
  - `public/src/components/dashboard/v2/AurumAccountDetailPage.tsx`
  - `public/src/components/dashboard/v2/AurumAccountsList.tsx`
  - `public/src/components/dashboard/v2/AurumBalanceHero.tsx`
  - `public/src/components/dashboard/v2/AurumBudgetDetail.tsx`
  - `public/src/components/dashboard/v2/AurumBudgetGlobalFocus.tsx`
  - `public/src/components/dashboard/v2/AurumBudgetPage.tsx`
  - `public/src/components/dashboard/v2/AurumCategoryBreakdown.tsx`
  - `public/src/components/dashboard/v2/AurumInsightsPage.tsx`
  - `public/src/components/dashboard/v2/AurumPortfolioDailyChart.tsx`
  - `public/src/components/dashboard/v2/AurumRecentTransactions.tsx`
  - `public/src/components/dashboard/v2/AurumRecurringPage.tsx`
  - `public/src/components/dashboard/v2/AurumTransactionDetail.tsx`
  - `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`
  - `public/src/components/dashboard/v2/AurumWealthAssets.tsx`
  - `public/src/components/dashboard/v2/AurumWealthDetailedChart.tsx`
  - `public/src/components/dashboard/v2/AurumWealthEvolution.tsx`
  - `public/src/components/dashboard/v2/AurumWealthPage.tsx`
  - `public/src/components/dashboard/v2/AurumWealthPositionsChart.tsx`
  - `public/src/components/dashboard/v2/CommandPalette.tsx`
  - `public/src/components/dashboard/v2/HistoryManagementModal.tsx`
  - `public/src/components/dashboard/v2/PlacementSnapshotModal.tsx`
  - `public/src/components/dashboard/v2/TrendLineChart.tsx`
  - `public/src/components/transactions/TransactionGroupedList.tsx`
  - `public/src/hooks/useSyncTransactions.ts`
  - `public/src/lib/search-utils.js`
  - `public/src/mobile/components/MPatrimoineChart.tsx`
  - `public/src/mobile/components/MPositionsChart.tsx`
  - `public/src/mobile/screens/PatrimoineScreen.tsx`
  - `public/src/utils/searchHelpers.ts`
  - `public/src/utils/ui-utils.js`

- [ ] **Step 1: Replace inline Intl.NumberFormat in all listed files**

Iteratively replace `new Intl.NumberFormat(...)` usages with `formatCurrency(...)` (or `fmt(...)` if applicable), preserving any custom formatting options (like `maximumFractionDigits`, `signDisplay`, etc.).
Make sure to add appropriate import of `formatCurrency` if not already present.

- [ ] **Step 2: Run npm run build to verify type checking and compilation**

Run: `npm run build`
Expected: Successful production build without compilation errors.

- [ ] **Step 3: Run all unit tests to ensure nothing broke**

Run: `npm test -- --run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

Propose commit: `perf: refactor inline Intl.NumberFormat allocations to cached formatCurrency`
