import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { BudgetFormModal } from '../../public/src/components/budgets-v2/BudgetFormModal';

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

vi.mock('../../public/src/context/BudgetContext', () => ({
  useBudgetContext: () => ({ updateAnnualDefault: vi.fn() }),
}));
vi.mock('../../public/src/hooks/useFirestoreErrorHandler', () => ({
  useFirestoreErrorHandler: () => ({ handle: vi.fn(), wrap: vi.fn() }),
}));
vi.mock('../../public/src/api/budgets', () => ({
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  suggestBudgetAmount: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [{ categorie: 'Courses', compte: 'LCL' }],
  }),
}));

describe('BudgetFormModal — accessibility', () => {
  beforeAll(() => {
    if (!document.body) document.body = document.createElement('body');
  });

  it('has no axe violations when creating a new budget', async () => {
    const { container } = render(<BudgetFormModal onClose={vi.fn()} onSave={vi.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when editing an existing budget', async () => {
    const { container } = render(
      <BudgetFormModal
        budget={{
          id: 'b1',
          nom: 'Courses',
          categorie: 'Alimentation',
          type: 'mensuel',
          montant: 400,
          actif: true,
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
