# PWA UX/UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PWA pages and layout for iPhone to resolve overlapping elements, small click targets, iOS input zoom, and layout overlaps behind the bottom nav bar.

**Architecture:**

- Restructure `MobileShell` / `MobileBottomNav` to position the bottom nav statically in the flex column, avoiding overlapping scrolls.
- Move filters on the Patrimoine (Audit) screen to a dedicated modal bottom sheet drawer, and place action buttons (Excel import, Filter) into the page header.
- Increase tap targets to a minimum of 44x44px and set input font-sizes to `text-base` (16px) to disable iOS auto-zoom.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, React Testing Library.

---

### Task 1: Restructure Mobile Bottom Nav Positioning

**Files:**

- Modify: `public/src/mobile/MobileBottomNav.tsx`

- [ ] **Step 1: Write a snapshot/rendering test for MobileBottomNav**

Ensure we have a test verifying `MobileBottomNav` renders its navigation items.
Create `public/src/mobile/__tests__/MobileBottomNav.test.tsx` with:

```tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from '../MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders all nav links', () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText('Console')).toBeInTheDocument();
    expect(screen.getByText('Flux')).toBeInTheDocument();
    expect(screen.getByText('Analyse')).toBeInTheDocument();
    expect(screen.getByText('Budgets')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify the new test runs (and passes since it's just rendering)**

Run: `npx vitest run public/src/mobile/__tests__/MobileBottomNav.test.tsx`
Expected: PASS

- [ ] **Step 3: Modify MobileBottomNav styles to remove fixed positioning**

Edit `public/src/mobile/MobileBottomNav.tsx`:
Change `className` of the root `<nav>` element from:

```tsx
className = 'fixed bottom-0 left-0 right-0 bg-ink-deep border-t border-glass-border z-nav';
```

To:

```tsx
className = 'bg-ink-deep border-t border-glass-border z-nav shrink-0';
```

- [ ] **Step 4: Run tests to ensure no regressions**

Run: `npx vitest run public/src/mobile/__tests__/MobileBottomNav.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/src/mobile/MobileBottomNav.tsx public/src/mobile/__tests__/MobileBottomNav.test.tsx
git commit -m "style(mobile): change bottom nav positioning to relative flex child"
```

---

### Task 2: Build Patrimoine Filter Drawer Component

**Files:**

- Create: `public/src/mobile/components/MPatrimoineFilterModal.tsx`
- Create: `public/src/mobile/components/__tests__/MPatrimoineFilterModal.test.tsx`

- [ ] **Step 1: Write tests for the new MPatrimoineFilterModal**

Write `public/src/mobile/components/__tests__/MPatrimoineFilterModal.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MPatrimoineFilterModal } from '../MPatrimoineFilterModal';

describe('MPatrimoineFilterModal', () => {
  it('renders filters and calls onChange', () => {
    const onChangeOwner = vi.fn();
    const onChangeType = vi.fn();
    const onClose = vi.fn();

    render(
      <MPatrimoineFilterModal
        owners={['Nicolas', 'Gwen']}
        ownerScope="all"
        onChangeOwner={onChangeOwner}
        wealthTypeScope="all"
        onChangeType={onChangeType}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('Filtrer le Patrimoine')).toBeInTheDocument();

    // Test owner change
    const nicolasBtn = screen.getByText('Nicolas');
    fireEvent.click(nicolasBtn);
    expect(onChangeOwner).toHaveBeenCalledWith(['Nicolas']);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (file doesn't exist yet)**

Run: `npx vitest run public/src/mobile/components/__tests__/MPatrimoineFilterModal.test.tsx`
Expected: FAIL (cannot resolve import)

- [ ] **Step 3: Implement MPatrimoineFilterModal**

Create `public/src/mobile/components/MPatrimoineFilterModal.tsx`:

```tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { MScreenHeader } from './MScreenHeader';

interface MPatrimoineFilterModalProps {
  owners: string[];
  ownerScope: string[] | 'all';
  onChangeOwner: (scope: string[] | 'all') => void;
  wealthTypeScope: string[] | 'all';
  onChangeType: (scope: string[] | 'all') => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { id: 'courants', label: 'Liquidités' },
  { id: 'epargnelivrets', label: 'Épargne' },
  { id: 'investissements', label: 'Investissements' },
  { id: 'retraite', label: 'Retraite' },
];

export const MPatrimoineFilterModal: React.FC<MPatrimoineFilterModalProps> = ({
  owners,
  ownerScope,
  onChangeOwner,
  wealthTypeScope,
  onChangeType,
  onClose,
}) => {
  const isAllOwners = ownerScope === 'all';
  const isAllTypes =
    wealthTypeScope === 'all' || (Array.isArray(wealthTypeScope) && wealthTypeScope.length === 0);

  const handleSelectOwner = (owner: string) => {
    if (isAllOwners) {
      onChangeOwner([owner]);
    } else {
      const next = ownerScope.includes(owner)
        ? ownerScope.filter((o) => o !== owner)
        : [...ownerScope, owner];
      onChangeOwner(next.length === 0 || next.length === owners.length ? 'all' : next);
    }
  };

  const handleSelectType = (typeId: string) => {
    if (isAllTypes) {
      onChangeType([typeId]);
    } else {
      const next = (wealthTypeScope as string[]).includes(typeId)
        ? (wealthTypeScope as string[]).filter((t) => t !== typeId)
        : [...(wealthTypeScope as string[]), typeId];
      onChangeType(next.length === 0 || next.length === TYPE_OPTIONS.length ? 'all' : next);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm px-4 pt-4 pb-0"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-ink border-t border-glass-border rounded-t-3xl w-full max-w-sm max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-2 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        <MScreenHeader
          title="Filtrer le Patrimoine"
          rightAction={
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center text-zinc-400"
            >
              <X size={20} />
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {/* Owners Selection */}
          <div className="space-y-3">
            <h3 className="text-m-label font-bold text-zinc-500 uppercase tracking-wider">
              Propriétaires
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => onChangeOwner('all')}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-m-body font-medium transition-all ${
                  isAllOwners
                    ? 'border-gold bg-gold/5 text-gold'
                    : 'border-glass-border bg-white/[0.02] text-zinc-400'
                }`}
              >
                <span>Tous</span>
                {isAllOwners && <Check size={16} />}
              </button>
              {owners.map((owner) => {
                const isActive = !isAllOwners && ownerScope.includes(owner);
                return (
                  <button
                    key={owner}
                    onClick={() => handleSelectOwner(owner)}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-m-body font-medium transition-all ${
                      isActive
                        ? 'border-gold bg-gold/5 text-gold'
                        : 'border-glass-border bg-white/[0.02] text-zinc-400'
                    }`}
                  >
                    <span>{owner}</span>
                    {isActive && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Types Selection */}
          <div className="space-y-3">
            <h3 className="text-m-label font-bold text-zinc-500 uppercase tracking-wider">
              Types d'actifs
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => onChangeType('all')}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-m-body font-medium transition-all ${
                  isAllTypes
                    ? 'border-gold bg-gold/5 text-gold'
                    : 'border-glass-border bg-white/[0.02] text-zinc-400'
                }`}
              >
                <span>Tous</span>
                {isAllTypes && <Check size={16} />}
              </button>
              {TYPE_OPTIONS.map((type) => {
                const isActive = !isAllTypes && (wealthTypeScope as string[]).includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => handleSelectType(type.id)}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-m-body font-medium transition-all ${
                      isActive
                        ? 'border-gold bg-gold/5 text-gold'
                        : 'border-glass-border bg-white/[0.02] text-zinc-400'
                    }`}
                  >
                    <span>{type.label}</span>
                    {isActive && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
```

- [ ] **Step 4: Run tests to verify the new filter modal passes its tests**

Run: `npx vitest run public/src/mobile/components/__tests__/MPatrimoineFilterModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/src/mobile/components/MPatrimoineFilterModal.tsx public/src/mobile/components/__tests__/MPatrimoineFilterModal.test.tsx
git commit -m "feat(mobile): add filter drawer modal for patrimoine screen"
```

---

### Task 3: Update Patrimoine Screen to use Header Actions & Filter Drawer

**Files:**

- Modify: `public/src/mobile/screens/PatrimoineScreen.tsx`

- [ ] **Step 1: Write/Update tests to confirm filters have been moved**

Ensure that since filters are now in a modal, the main Patrimoine screen renders the new Header Actions instead of the old filter pills.
Create/Update `public/src/mobile/screens/__tests__/PatrimoineScreen.test.tsx` if it exists, or just verify rendering using vitest.
Let's see if a test exists first. Since none exists, we'll verify manually and check the build.

- [ ] **Step 2: Modify PatrimoineScreen.tsx to implement the new layout**

Open `public/src/mobile/screens/PatrimoineScreen.tsx`.

1. Import `Filter` from `lucide-react`.
2. Import `MPatrimoineFilterModal` from `../components/MPatrimoineFilterModal`.
3. Add local state: `const [showFilterModal, setShowFilterModal] = useState(false);`
4. Update `MScreenHeader` to include:

```tsx
<MScreenHeader
  title="Patrimoine"
  rightAction={
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowImportModal(true)}
        className="w-11 h-11 flex items-center justify-center text-zinc-400 active:text-white"
        title="Importer historique Excel"
      >
        <FileUp size={22} />
      </button>
      <button
        onClick={() => setShowFilterModal(true)}
        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
          ownerScope !== 'all' || wealthTypeScope !== 'all'
            ? 'bg-gold/10 text-gold border border-gold/20'
            : 'text-zinc-400 active:text-white'
        }`}
        title="Filtrer"
      >
        <Filter size={22} />
      </button>
    </div>
  }
/>
```

5. Remove the old pills section:

```tsx
// Remove this block completely
<div className="space-y-1">
  <MOwnerScopePills owners={owners} currentScope={ownerScope} onChange={setOwnerScope} />
  <MTypeScopePills currentScope={wealthTypeScope} onChange={setWealthTypeScope} />
</div>
```

6. Remove the old absolute file upload button inside `<section className="px-4 py-8 flex flex-col items-center justify-center text-center relative">`:

```tsx
// Remove this button completely
<button
  onClick={() => setShowImportModal(true)}
  className="absolute top-4 right-4 w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/30 active:text-gold active:border-gold/30 transition-all"
  title="Importer historique Excel"
>
  <FileUp size={20} />
</button>
```

7. Fix the plus button tap target in Allocations title from `w-8 h-8` to `w-11 h-11` (or add proper paddings).
8. Change text sizes `text-[10px]` to `text-m-label` (12px) or `text-m-caption` (13px) for Boursier Portfolio holdings (lines 244, 265, 274, 277).
9. Add the modal at the bottom of the component:

```tsx
{
  showFilterModal && (
    <MPatrimoineFilterModal
      owners={owners}
      ownerScope={ownerScope}
      onChangeOwner={setOwnerScope}
      wealthTypeScope={wealthTypeScope}
      onChangeType={setWealthTypeScope}
      onClose={() => setShowFilterModal(false)}
    />
  );
}
```

- [ ] **Step 3: Run project tests to ensure no compilation issues**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/screens/PatrimoineScreen.tsx
git commit -m "feat(mobile): integrate header actions and filter drawer in patrimoine screen"
```

---

### Task 4: Optimize Charts UI (Tapping & Text size fixes)

**Files:**

- Modify: `public/src/mobile/components/MPatrimoineChart.tsx`
- Modify: `public/src/mobile/components/MPositionsChart.tsx`

- [ ] **Step 1: Update MPatrimoineChart range buttons**

Open `public/src/mobile/components/MPatrimoineChart.tsx`.
Change range buttons style:
Replace:

```tsx
className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
  timeRange === r ? 'bg-gold text-ink-deep' : 'text-white/30 hover:text-white'
}`}
```

With:

```tsx
className={`px-3 py-1.5 rounded-lg text-m-label font-bold uppercase tracking-wider transition-all min-h-[32px] ${
  timeRange === r ? 'bg-gold text-ink-deep' : 'text-zinc-500 active:text-white'
}`}
```

- [ ] **Step 2: Update MPositionsChart ranges and legends**

Open `public/src/mobile/components/MPositionsChart.tsx`.

1. Modify the range selector styling (lines 80-90) to match the larger, finger-friendly buttons in Step 1.
2. Remove the redundant tiny dot-only toggles at the top right of the chart layout:

```tsx
// Remove this block:
<div className="flex items-center gap-2">
  {SERIES.map((s) => (
    <button
      key={s.key}
      onClick={() => toggleSeries(s.key)}
      className="flex items-center gap-1 transition-opacity"
      style={{ opacity: hidden.has(s.key) ? 0.3 : 1 }}
    >
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
    </button>
  ))}
</div>
```

3. Agrandir les boutons de légende en bas de page (lignes 152-169):
   Change the toggle button class in legends:
   Replace:

```tsx
<span
  className="text-[9px] font-black uppercase tracking-widest"
  style={{ color: s.color + 'CC' }}
>
```

With:

```tsx
<span
  className="text-m-label font-bold uppercase tracking-wider"
  style={{ color: s.color }}
>
```

And give the buttons more padding, e.g. `px-3 py-2 bg-white/[0.02] border border-glass-border rounded-xl`.

- [ ] **Step 3: Run Vitest to check no errors**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/components/MPatrimoineChart.tsx public/src/mobile/components/MPositionsChart.tsx
git commit -m "style(mobile): optimize chart range buttons and legend tap targets"
```

---

### Task 5: Correct iOS Input Zoom (16px text-base size) across all mobile forms

**Files:**

- Modify: `public/src/mobile/screens/QAScreen.tsx`
- Modify: `public/src/mobile/components/MAccountReconcileSheet.tsx`
- Modify: `public/src/mobile/components/MPlacementFormModal.tsx`
- Modify: `public/src/mobile/components/MBudgetFormModal.tsx`
- Modify: `public/src/mobile/components/MTransactionFilterModal.tsx`
- Modify: `public/src/mobile/components/MAIConfigSheet.tsx`
- Modify: `public/src/mobile/components/MSettingsModal.tsx`

- [ ] **Step 1: Fix QAScreen.tsx textarea zoom**

Open `public/src/mobile/screens/QAScreen.tsx`.
Find `<textarea>` and replace `text-sm` with `text-base`.

- [ ] **Step 2: Fix MAccountReconcileSheet.tsx input zoom and small font violations**

Open `public/src/mobile/components/MAccountReconcileSheet.tsx`.

1. Replace `text-m-body` on `<input id="m-reconcile-manual"` with `text-base`.
2. Replace `text-[9px] font-black` (line 207) with `text-m-caption`.
3. Replace `text-[8px] font-black` (lines 219, 226, 234) with `text-m-label` or `text-m-caption`.
4. Replace `text-[10px] font-black` (lines 247, 254) with `text-m-label`.

- [ ] **Step 3: Fix MPlacementFormModal.tsx input zoom**

Open `public/src/mobile/components/MPlacementFormModal.tsx`.

1. Remplacer `text-m-body` sur `id="nom"` (line 145) par `text-base`.
2. Remplacer `text-m-title` sur `id="montant"` (line 190) par `text-base`.
3. Remplacer `text-m-body` sur `id="owner"` (line 207) par `text-base`.

- [ ] **Step 4: Fix MBudgetFormModal.tsx input zoom**

Open `public/src/mobile/components/MBudgetFormModal.tsx`.
Replace `text-m-title` on the budget amount input (line 147) with `text-base`.

- [ ] **Step 5: Fix MTransactionFilterModal.tsx, MAIConfigSheet.tsx, and MSettingsModal.tsx input zoom**

Find and replace all `text-m-body` / `text-sm` classes on `<input>`, `<select>`, and `<textarea>` elements in these files with `text-base` (16px) to ensure no input zoom occurs on iOS Safari.

- [ ] **Step 6: Run full test suite and confirm everything passes**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add public/src/mobile/screens/QAScreen.tsx public/src/mobile/components/MAccountReconcileSheet.tsx public/src/mobile/components/MPlacementFormModal.tsx public/src/mobile/components/MBudgetFormModal.tsx public/src/mobile/components/MTransactionFilterModal.tsx public/src/mobile/components/MAIConfigSheet.tsx public/src/mobile/components/MSettingsModal.tsx
git commit -m "fix(mobile): use text-base for all forms inputs to prevent iOS auto-zoom"
```
