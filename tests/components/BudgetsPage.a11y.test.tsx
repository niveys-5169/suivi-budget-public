import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { BudgetsPage } from '../../public/src/components/budgets-v2/BudgetsPage';
import { useBudget } from '../../public/src/hooks/useBudget';
import { useTransactions } from '../../public/src/hooks/useTransactions';
import { useAppState } from '../../public/src/context/AppStateContext';

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

vi.mock('../../public/src/hooks/useBudget', () => ({ useBudget: vi.fn() }));
vi.mock('../../public/src/hooks/useTransactions', () => ({ useTransactions: vi.fn() }));
vi.mock('../../public/src/hooks/useDashboard', () => ({
  useDashboard: () => ({ recurringSettings: {} }),
}));
vi.mock('../../public/src/context/AppStateContext', () => ({ useAppState: vi.fn() }));

vi.mock('../../public/src/components/budgets-v2/BudgetHeaderSummary', () => ({
  BudgetHeaderSummary: () => <div data-testid="budget-summary" />,
}));
vi.mock('../../public/src/components/budgets-v2/BudgetCategoryScopeBar', () => ({
  BudgetCategoryScopeBar: () => <div data-testid="scope-bar" />,
}));
vi.mock('../../public/src/components/budgets-v2/BudgetCategoryList', () => ({
  BudgetCategoryList: () => <div data-testid="cat-list" />,
}));
vi.mock('../../public/src/components/budgets-v2/BudgetDetailModal', () => ({
  BudgetDetailModal: () => null,
}));
vi.mock('../../public/src/components/budgets-v2/BudgetFormModal', () => ({
  BudgetFormModal: () => null,
}));
vi.mock('../../public/src/components/budgets-v2/BudgetManagerPanel', () => ({
  BudgetManagerPanel: () => null,
}));
vi.mock('../../public/src/components/budgets-v2/RAVEditor', () => ({
  RAVEditor: () => null,
}));
vi.mock('../../public/src/api/consumption', () => ({
  computeConsumption: () => ({ depense: 0, montant: 100, pourcentage: 0, reste: 100 }),
}));

describe('BudgetsPage — accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useBudget as any).mockReturnValue({
      budgets: [
        {
          id: 'b1',
          nom: 'Courses',
          categorie: 'Alimentation',
          montant: 400,
          actif: true,
          type: 'mensuel',
        },
      ],
      loading: false,
      refresh: vi.fn(),
    });
    (useTransactions as any).mockReturnValue({ loading: false });
    (useAppState as any).mockReturnValue({
      budgetCategoryScope: ['b1'],
      setBudgetCategoryScope: vi.fn(),
      budgetCalculationScope: ['b1'],
      setBudgetCalculationScope: vi.fn(),
      budgetPeriodMode: 'month',
      setBudgetPeriodMode: vi.fn(),
      isBudgetScopeVisible: false,
      setIsBudgetScopeVisible: vi.fn(),
    });
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <BudgetsPage />
      </MemoryRouter>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
