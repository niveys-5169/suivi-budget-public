# Implement AssetScopeTabs Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `AssetScopeTabs` component for filtering assets by scope (all, checking, savings, investment, credit) with AURUM branding.

**Architecture:** A stateless functional React component that receives `activeScope` and `onScopeChange` as props. It maps over a predefined list of scopes and renders them as buttons.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, React Testing Library.

---

### Task 1: Create failing test for AssetScopeTabs

**Files:**

- Create: `tests/components/dashboard/AssetScopeTabs.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AssetScopeTabs,
  AssetScope,
} from '../../../public/src/components/dashboard/AssetScopeTabs';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

describe('AssetScopeTabs', () => {
  it('renders all scope tabs', () => {
    const onScopeChange = vi.fn();
    render(<AssetScopeTabs activeScope="all" onScopeChange={onScopeChange} />);

    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('Courant')).toBeInTheDocument();
    expect(screen.getByText('Épargne')).toBeInTheDocument();
    expect(screen.getByText('Bourse')).toBeInTheDocument();
    expect(screen.getByText('Crédit')).toBeInTheDocument();
  });

  it('calls onScopeChange when a tab is clicked', () => {
    const onScopeChange = vi.fn();
    render(<AssetScopeTabs activeScope="all" onScopeChange={onScopeChange} />);

    fireEvent.click(screen.getByText('Épargne'));
    expect(onScopeChange).toHaveBeenCalledWith('savings');
  });

  it('highlights the active scope', () => {
    const onScopeChange = vi.fn();
    const { rerender } = render(<AssetScopeTabs activeScope="all" onScopeChange={onScopeChange} />);

    // Check "Tous" has gold background
    const allTab = screen.getByText('Tous');
    expect(allTab).toHaveClass('bg-gold');

    rerender(<AssetScopeTabs activeScope="savings" onScopeChange={onScopeChange} />);
    const savingsTab = screen.getByText('Épargne');
    expect(savingsTab).toHaveClass('bg-gold');
    expect(screen.getByText('Tous')).not.toHaveClass('bg-gold');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest tests/components/dashboard/AssetScopeTabs.test.tsx --run`
Expected: FAIL (Module not found)

**Step 3: Commit (Test only)**

```bash
git add tests/components/dashboard/AssetScopeTabs.test.tsx
git commit -m "test: add tests for AssetScopeTabs"
```

---

### Task 2: Implement AssetScopeTabs component

**Files:**

- Create: `public/src/components/dashboard/AssetScopeTabs.tsx`

**Step 1: Write the implementation**

```tsx
import React from 'react';

export type AssetScope = 'all' | 'checking' | 'savings' | 'investment' | 'credit';

interface Props {
  activeScope: AssetScope;
  onScopeChange: (scope: AssetScope) => void;
}

const SCOPES: { id: AssetScope; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'checking', label: 'Courant' },
  { id: 'savings', label: 'Épargne' },
  { id: 'investment', label: 'Bourse' },
  { id: 'credit', label: 'Crédit' },
];

export const AssetScopeTabs: React.FC<Props> = ({ activeScope, onScopeChange }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
      {SCOPES.map((scope) => (
        <button
          key={scope.id}
          onClick={() => onScopeChange(scope.id)}
          className={`shrink-0 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all border
            ${
              activeScope === scope.id
                ? 'bg-gold text-ink border-gold'
                : 'bg-glass border-glass-border text-platinum/40 hover:text-white'
            }`}
        >
          {scope.label}
        </button>
      ))}
    </div>
  );
};
```

**Step 2: Run test to verify it passes**

Run: `npx vitest tests/components/dashboard/AssetScopeTabs.test.tsx --run`
Expected: PASS

**Step 3: Commit**

```bash
git add public/src/components/dashboard/AssetScopeTabs.tsx
git commit -m "ui: add asset scope filter tabs"
```

---

### Task 3: Ensure no-scrollbar utility exists

**Files:**

- Modify: `public/src/tailwind.css`

**Step 1: Add no-scrollbar if not present**

Check if `no-scrollbar` exists in `public/src/tailwind.css`. If not, add it.

```css
@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

**Step 2: Commit**

```bash
git add public/src/tailwind.css
git commit -m "style: add no-scrollbar utility"
```
