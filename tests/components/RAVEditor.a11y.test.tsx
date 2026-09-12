import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { RAVEditor } from '../../public/src/components/budgets-v2/RAVEditor';

expect.extend(toHaveNoViolations);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Stable references — RAVEditor memoises `persistedConfig` on globalRavConfig
// reference equality. Returning a fresh object from useGlobalData on every
// render would otherwise trigger a reset() loop.
const STABLE_TRANSACTIONS: any[] = [];
const STABLE_BALANCES = [
  { id: 'lcl', compte: 'LCL Courant', current_balance: 4500 },
  { id: 'bourso', compte: 'Boursorama', current_balance: 12000 },
];
const STABLE_RAV_CONFIG = {
  revenu_mensuel_net: null,
  provision_salaires: {},
  revenu_categories: [],
  depense_categories: [],
  included_accounts: [],
};
const STABLE_RECURRENCES: any[] = [];
const STABLE_GLOBAL = {
  accountBalances: STABLE_BALANCES,
  ravConfig: STABLE_RAV_CONFIG,
  recurrences: STABLE_RECURRENCES,
};

vi.mock('../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({ transactions: STABLE_TRANSACTIONS }),
}));
vi.mock('../../public/src/context/BudgetContext', () => ({
  useBudgetContext: () => ({ getBudgetCategoryCandidates: () => [] }),
}));
vi.mock('../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: () => STABLE_GLOBAL,
}));
vi.mock('../../public/src/services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  app: {},
  functions: {},
  googleProvider: {},
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

describe('RAVEditor — accessibility', () => {
  beforeAll(() => {
    if (!document.body) document.body = document.createElement('body');
  });

  it('has no axe violations in read-only state', async () => {
    const { container } = render(<RAVEditor monthKey="2026-04" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when the close button is present', async () => {
    const { container } = render(<RAVEditor monthKey="2026-04" onClose={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
