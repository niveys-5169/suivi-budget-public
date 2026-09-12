# Task WP-G: Isolated cases (6 distinct any warning fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 6 specific `any` type annotations in the Suivi-Budget codebase to improve type safety and achieve zero linter warnings for these files.

**Architecture:** We will replace `any` casts and annotations with precise types, using existing types (like `User` from `firebase/auth` and `Transaction` from `banking.types.ts`) or narrow castings/types (`Record<string, unknown>`), while ensuring full compatibility with existing consumers.

**Tech Stack:** React 18, TypeScript, ESLint.

---

### Task 1: Fix `useAuth.tsx`

**Files:**

- Modify: `public/src/hooks/useAuth.tsx:1-25`

- [ ] **Step 1.1: Modify imports and type definition**
      Update imports to include `type User` from `firebase/auth`, and change the `user` property in `UseAuthResult` to `User | null`.

  ```typescript
  import {
    type Auth,
    type User,
    signInWithRedirect,
    signInWithPopup,
    signOut as firebaseSignOut,
  } from 'firebase/auth';
  ```

  And:

  ```typescript
  type UseAuthResult = {
    user: User | null;
    loading: boolean;
    error: string | null;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
  };
  ```

- [ ] **Step 1.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify that `useAuth.tsx` compiles and has no lint warnings.

---

### Task 2: Fix `useGlobalSearch.tsx`

**Files:**

- Modify: `public/src/hooks/useGlobalSearch.tsx:18-27`

- [ ] **Step 2.1: Remove unnecessary cast**
      Remove the `as any[]` cast when calling `searchGlobal`, since `Transaction` is fully compatible with `TxLike`.

  ```typescript
  export const useGlobalSearch = (query: string): SearchResult[] => {
    const { transactions } = useTransactionContext();
    const debouncedQuery = useDebounce(query, 150);

    return useMemo(
      () => searchGlobal(debouncedQuery, transactions, NAVIGABLE_PAGES),
      [debouncedQuery, transactions],
    );
  };
  ```

- [ ] **Step 2.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify no warnings/errors are present.

---

### Task 3: Fix `formatters.ts`

**Files:**

- Modify: `public/src/lib/formatters.ts:10-22`

- [ ] **Step 3.1: Cast keys of Intl.NumberFormatOptions**
      Avoid using `any` on `options` in line 13. Use `options[k as keyof Intl.NumberFormatOptions]`.

  ```typescript
  const getFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const optionsKey = Object.keys(options)
      .sort()
      .map((k) => `${k}:${options[k as keyof Intl.NumberFormatOptions]}`)
      .join('|');
    const key = `${locale}-${optionsKey}`;
    let formatter = formatterCache.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, options);
      formatterCache.set(key, formatter);
    }
    return formatter;
  };
  ```

- [ ] **Step 3.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify no warnings/errors are present.

---

### Task 4: Fix `MobileShell.tsx`

**Files:**

- Modify: `public/src/mobile/MobileShell.tsx:5-9`

- [ ] **Step 4.1: Custom cast for navigator standalone property**
      Change the `(window.navigator as any).standalone` cast to `(window.navigator as Navigator & { standalone?: boolean }).standalone`.

  ```typescript
  export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const isStandalone =
      typeof window !== 'undefined' &&
      (((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
        window.matchMedia('(display-mode: standalone)').matches);
  ```

- [ ] **Step 4.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify no warnings/errors are present.

---

### Task 5: Fix `HomeScreen.tsx`

**Files:**

- Modify: `public/src/mobile/screens/HomeScreen.tsx:1-40`

- [ ] **Step 5.1: Import Transaction and type editingTx state**
      Import `type Transaction` from `../../types/banking.types` and type the `editingTx` state as `Transaction | null`.

  ```typescript
  import type { Transaction } from '../../types/banking.types';
  ```

  And:

  ```typescript
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  ```

- [ ] **Step 5.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify no warnings/errors are present.

---

### Task 6: Fix `positionsHistoryExcel.ts`

**Files:**

- Modify: `public/src/utils/positionsHistoryExcel.ts:117-155`

- [ ] **Step 6.1: Type row argument as Record<string, unknown>**
      Cast the mapping loop rows to `Record<string, unknown>` and access fields safely.

  ```typescript
  export function parseHistoryRows(rows: unknown[]): ParsedHistoryRow[] {
    return rows.map((rawRow) => {
      const row = rawRow as Record<string, unknown>;
      const errors: string[] = [];

      // Mappage par header (robuste aux espaces et à la casse)
      const findValue = (key: string) => {
        const col = HISTORY_COLUMNS.find((c) => c.key === key);
        if (!col) return undefined;
        const rowKey = Object.keys(row).find(
          (k) => k.trim().toLowerCase() === col.header.trim().toLowerCase(),
        );
        return rowKey ? row[rowKey] : undefined;
      };
  ```

- [ ] **Step 6.2: Run typecheck and lint**
      Run: `npm run typecheck` and `npm run lint` to verify no warnings/errors are present.

---

### Task 7: Verification

- [ ] **Step 7.1: Verify typecheck and lint across the codebase**
      Run: `npm run typecheck` and `npm run lint`. Ensure that the 6 warnings in those files are gone.
- [ ] **Step 7.2: Run tests**
      Run: `npm test` and ensure all tests pass (548 tests).
- [ ] **Step 7.3: Commit changes**
      Commit with: `refactor(types): eliminate isolated any warnings in hooks, lib, mobile, and utils`
