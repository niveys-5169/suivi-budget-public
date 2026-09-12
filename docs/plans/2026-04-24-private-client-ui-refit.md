# AURUM Private Client Refit Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transition the Dashboard UI from horizontal 3D cards to a centered "Private Client" hero and a vertical grouped account registry with collapsible sections.

**Architecture:**

- `PrivateBalanceHero`: Centered total balance with sync status and quick action icons.
- `AssetScopeTabs`: Horizontal scrollable filter for asset classes.
- `AccountRegistry`: Vertical list grouping accounts by type (Checking, Savings, etc.) using `AccountSlab` components.
- State-driven filtering and section toggling in `Dashboard.tsx`.

**Tech Stack:** React 18, Tailwind CSS, Framer Motion, Lucide Icons.

---

### Task 1: Create PrivateBalanceHero

**Files:**

- Create: `public/src/components/dashboard/PrivateBalanceHero.tsx`
- Modify: `public/src/components/dashboard/Dashboard.tsx`

**Step 1: Implement PrivateBalanceHero component**
Create a new component that centers the balance and adds corner icons.

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../lib/formatters';
import { usePreferences } from '../../hooks/usePreferences';
import type { Currency } from '../../types/banking.types';

interface Props {
  totalBalance: number;
  currency: Currency;
  variation: number;
  variationAmount: number;
  lastSync?: string;
}

export const PrivateBalanceHero: React.FC<Props> = ({
  totalBalance,
  currency,
  variation,
  variationAmount,
  lastSync = "à l'instant",
}) => {
  const { privacyMode, setPrivacyMode } = usePreferences();
  const isPositive = variationAmount >= 0;

  return (
    <section className="relative pt-12 pb-16 text-center space-y-8">
      {/* Quick Actions */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 md:px-0">
        <button className="p-3 rounded-full bg-glass border border-glass-border text-platinum/40 hover:text-white transition-colors">
          <Bell size={20} />
        </button>
        <button className="p-3 rounded-full bg-glass border border-glass-border text-platinum/40 hover:text-white transition-colors">
          <Search size={20} />
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-platinum/30">
          Synchronisé {lastSync}
        </p>

        <div className="relative inline-block group">
          <AnimatePresence mode="wait">
            <motion.h1
              key={privacyMode ? 'hidden' : 'visible'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-serif text-5xl md:text-7xl font-bold tracking-tight text-white tabular-nums"
              onClick={() => setPrivacyMode(!privacyMode)}
            >
              {privacyMode ? '•••••• €' : formatCurrency(totalBalance, currency)}
            </motion.h1>
          </AnimatePresence>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className="absolute -right-12 top-1/2 -translate-y-1/2 p-2 text-platinum/20 hover:text-gold transition-colors"
          >
            {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div
          className={`flex items-center justify-center gap-2 text-sm font-bold ${isPositive ? 'text-gold' : 'text-ruby'}`}
        >
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span>
            {formatPercent(variation)} ({formatCurrency(variationAmount, currency)})
          </span>
        </div>
      </div>
    </section>
  );
};
```

**Step 2: Update Dashboard to use new Hero**
Replace `BalanceHero` with `PrivateBalanceHero`.

**Step 3: Commit**
`git add public/src/components/dashboard/PrivateBalanceHero.tsx && git commit -m "ui: implement centered private client hero"`

---

### Task 2: Implement AssetScopeTabs

**Files:**

- Create: `public/src/components/dashboard/AssetScopeTabs.tsx`

**Step 1: Implement the tab component**

```tsx
import React from 'react';

type AssetScope = 'all' | 'checking' | 'savings' | 'investment' | 'credit';

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
          className={`shrink-0 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border
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

**Step 2: Commit**
`git commit -m "ui: add asset scope filter tabs"`

---

### Task 3: Create AccountRegistry & AccountSlab

**Files:**

- Create: `public/src/components/dashboard/AccountSlab.tsx`
- Create: `public/src/components/dashboard/AccountRegistry.tsx`

**Step 1: Implement AccountSlab (The individual card)**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import type { Account } from '../../types/banking.types';

export const AccountSlab: React.FC<{ account: Account }> = ({ account }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="glass-panel rounded-[1.5rem] p-6 flex items-center justify-between group cursor-pointer"
    >
      <div className="space-y-1">
        <p className="font-serif text-2xl font-bold text-white tabular-nums group-hover:text-gold transition-colors">
          {formatCurrency(account.balance, account.currency)}
        </p>
        <p className="text-sm font-bold text-platinum/80">{account.name}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-platinum/30">
          {account.bankName || 'Private Bank'}
        </p>
      </div>
      <ChevronRight
        className="text-platinum/10 group-hover:text-gold transition-colors"
        size={20}
      />
    </motion.div>
  );
};
```

**Step 2: Implement AccountRegistry (Grouped List)**

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { AccountSlab } from './AccountSlab';
import type { Account } from '../../types/banking.types';

interface Props {
  accounts: Account[];
  activeScope: string;
}

export const AccountRegistry: React.FC<Props> = ({ accounts, activeScope }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = {
    'Compte courant': accounts.filter((a) => a.type === 'CHECKING'),
    Épargne: accounts.filter((a) => a.type === 'SAVINGS'),
    'Bourse & Placements': accounts.filter((a) => a.type === 'INVESTMENT'),
  };

  return (
    <div className="space-y-12">
      {Object.entries(groups).map(([title, items]) => {
        if (items.length === 0) return null;
        const isCollapsed = collapsed[title];

        return (
          <section key={title} className="space-y-6">
            <button
              onClick={() => setCollapsed((prev) => ({ ...prev, [title]: !isCollapsed }))}
              className="flex items-center justify-between w-full px-2"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-platinum/40">
                {title}
              </h3>
              <ChevronDown
                size={14}
                className={`text-platinum/20 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  {items.map((acc) => (
                    <AccountSlab key={acc.id} account={acc} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
};
```

**Step 3: Commit**
`git commit -m "ui: implement grouped account registry with slabs"`

---

### Task 4: Final Integration

**Files:**

- Modify: `public/src/components/dashboard/Dashboard.tsx`

**Step 1: Wire up the scope state**
In `Dashboard.tsx`, add `const [scope, setScope] = useState<AssetScope>('all');`.

**Step 2: Layout the new sections**
Place `PrivateBalanceHero`, then `AssetScopeTabs`, then `AccountRegistry` in the main dashboard content area.

**Step 3: Verify and Cleanup**
Remove legacy `AccountCards` and original `BalanceHero` if no longer needed.

**Step 4: Commit**
`git commit -m "feat: complete private client refit integration"`
