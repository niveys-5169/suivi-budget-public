# Aurum Dashboard V2 Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter la V2 du tableau de bord (thème sombre "Private Client") à l'aide de données mockées avant l'intégration finale.

**Architecture:** Nous allons créer trois nouveaux composants (`AurumBalanceHero`, `AurumAccountsList`, `AurumDashboard`) dans le dossier `public/src/components/dashboard/v2/`. Chaque composant sera développé en TDD (Test Driven Development).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Vitest, React Testing Library.

---

### Task 1: Création du composant AurumBalanceHero

**Files:**

- Create: `tests/components/dashboard/v2/AurumBalanceHero.test.tsx`
- Create: `public/src/components/dashboard/v2/AurumBalanceHero.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AurumBalanceHero } from '../../../../public/src/components/dashboard/v2/AurumBalanceHero';

describe('AurumBalanceHero Component', () => {
  it('renders the total balance in gold/premium style', () => {
    render(<AurumBalanceHero totalBalance={150000} />);

    const balanceElement = screen.getByText('150 000,00 €');
    expect(balanceElement).toBeInTheDocument();
    // Verify playfair font and gold color
    expect(balanceElement.className).toContain('font-serif');
    expect(balanceElement.className).toContain('text-gold');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dashboard/v2/AurumBalanceHero.test.tsx`
Expected: FAIL with "Cannot find module" or "AurumBalanceHero is not defined"

**Step 3: Write minimal implementation**

```tsx
import React from 'react';

interface Props {
  totalBalance: number;
}

export const AurumBalanceHero: React.FC<Props> = ({ totalBalance }) => {
  const formattedBalance = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(totalBalance);

  return (
    <div className="glass-panel rounded-[2.5rem] p-10 relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />
      <p className="text-[10px] font-black uppercase tracking-[0.45em] text-platinum/30 mb-2">
        Total Consolidé
      </p>
      <h1 className="font-serif text-5xl md:text-7xl font-semibold tracking-tight text-gold [font-variant-numeric:tabular-nums]">
        {formattedBalance}
      </h1>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dashboard/v2/AurumBalanceHero.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/components/dashboard/v2/AurumBalanceHero.test.tsx public/src/components/dashboard/v2/AurumBalanceHero.tsx
git commit -m "feat(dashboard-v2): create AurumBalanceHero component with TDD"
```

---

### Task 2: Création de AurumAccountsList

**Files:**

- Create: `tests/components/dashboard/v2/AurumAccountsList.test.tsx`
- Create: `public/src/components/dashboard/v2/AurumAccountsList.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AurumAccountsList } from '../../../../public/src/components/dashboard/v2/AurumAccountsList';

describe('AurumAccountsList Component', () => {
  it('renders a list of accounts with dark theme classes', () => {
    const mockAccounts = [{ id: '1', name: 'Compte Courant', balance: 12450 }];
    render(<AurumAccountsList accounts={mockAccounts} />);

    const accountName = screen.getByText('Compte Courant');
    expect(accountName).toBeInTheDocument();

    const container = screen.getByTestId('account-1-card');
    expect(container.className).toContain('bg-[#121622]');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dashboard/v2/AurumAccountsList.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
import React from 'react';
import { motion } from 'framer-motion';

interface Account {
  id: string;
  name: string;
  balance: number;
}

export const AurumAccountsList: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  return (
    <div className="space-y-4">
      {accounts.map((acc) => (
        <motion.div
          key={acc.id}
          data-testid={`account-${acc.id}-card`}
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-[#121622] border border-glass-border rounded-[2rem] p-6 flex items-center justify-between"
        >
          <p className="text-sm font-bold text-white">{acc.name}</p>
          <p className="font-sans text-lg font-bold text-white tabular-nums">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
              acc.balance,
            )}
          </p>
        </motion.div>
      ))}
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dashboard/v2/AurumAccountsList.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/components/dashboard/v2/AurumAccountsList.test.tsx public/src/components/dashboard/v2/AurumAccountsList.tsx
git commit -m "feat(dashboard-v2): create AurumAccountsList component with TDD"
```

---

### Task 3: Assemblage du AurumDashboard

**Files:**

- Create: `public/src/components/dashboard/v2/AurumDashboard.tsx`
- Modify: `public/src/App.tsx` (ou le router pour afficher la V2 en test)

**Step 1: Write the failing test**

```tsx
// in tests/components/dashboard/v2/AurumDashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AurumDashboard } from '../../../../public/src/components/dashboard/v2/AurumDashboard';

describe('AurumDashboard Component', () => {
  it('renders hero and accounts list', () => {
    render(<AurumDashboard />);
    expect(screen.getByText('Total Consolidé')).toBeInTheDocument();
    expect(screen.getByText('Mes comptes')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/dashboard/v2/AurumDashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
import React from 'react';
import { AurumBalanceHero } from './AurumBalanceHero';
import { AurumAccountsList } from './AurumAccountsList';

// Mock data
const MOCK_DATA = {
  total: 115900,
  accounts: [
    { id: '1', name: 'Compte Courant LCL', balance: 4500 },
    { id: '2', name: 'Livret A', balance: 111400 },
  ],
};

export const AurumDashboard: React.FC = () => {
  return (
    <div className="premium-container pt-12 pb-24 min-h-screen bg-[#0B0B14]">
      <div className="space-y-12">
        <AurumBalanceHero totalBalance={MOCK_DATA.total} />

        <section>
          <div className="flex items-center justify-between px-2 mb-6">
            <h2 className="text-2xl font-black tracking-tighter text-white">Mes comptes</h2>
          </div>
          <AurumAccountsList accounts={MOCK_DATA.accounts} />
        </section>
      </div>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/dashboard/v2/AurumDashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/components/dashboard/v2/AurumDashboard.test.tsx public/src/components/dashboard/v2/AurumDashboard.tsx
git commit -m "feat(dashboard-v2): assemble main AurumDashboard with mock data"
```
