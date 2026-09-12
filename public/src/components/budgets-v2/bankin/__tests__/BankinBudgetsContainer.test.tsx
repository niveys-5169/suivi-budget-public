import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BankinBudgetsContainer } from '../BankinBudgetsContainer';
import React from 'react';

// Mock contexts
const mockSetViewMode = vi.fn();
vi.mock('../../../../context/BudgetContext', () => ({
  useBudgetContext: () => ({
    budgets: [
      { categorie: 'Logement', montant: 1000, actif: true },
      { categorie: 'Alimentation', montant: 500, actif: true },
    ],
    monthKey: '2026-04',
    setMonthKey: vi.fn(),
    viewMode: 'monthly',
    setViewMode: mockSetViewMode,
  }),
}));

vi.mock('../../../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: [
      { id: '1', date: '2026-04-01', libelle: 'Loyer', montant: -1000, categorie: 'Logement' },
      { id: '2', date: '2026-04-10', libelle: 'Courses', montant: -200, categorie: 'Alimentation' },
    ],
    loading: false,
    requestFullLoad: vi.fn(),
  }),
}));

// Mock Recharts
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    AreaChart: ({ children }: any) => <div>{children}</div>,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
  };
});

describe('BankinBudgetsContainer', () => {
  it('renders summary and category grid', () => {
    render(<BankinBudgetsContainer />);

    // Total spent: 1000 + 200 = 1200
    expect(screen.getAllByText(/1 200/)[0]).toBeInTheDocument();

    // Total budget: 1000 + 500 = 1500
    expect(screen.getAllByText(/1 500/)[0]).toBeInTheDocument();

    // Categories
    expect(screen.getByText(/logement/i)).toBeInTheDocument();
    expect(screen.getByText(/alimentation/i)).toBeInTheDocument();
  });

  it('toggles view mode between monthly and annual', () => {
    render(<BankinBudgetsContainer />);

    const monthlyBtn = screen.getByText('Mois');
    const annualBtn = screen.getByText('Année');

    fireEvent.click(annualBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith('annual');

    fireEvent.click(monthlyBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith('monthly');
  });

  it('sorts categories by spent amount descending', () => {
    // Modify mock for this specific test to have different spent amounts
    // Since we mock the context at the top level, we might need a more flexible mock
    // but for now let's just check if the categories are rendered in some order
    // In our top-level mock:
    // Logement: spent 1000, budget 1000
    // Alimentation: spent 200, budget 500
    // With b.spent - a.spent, Logement (1000) should be before Alimentation (200)

    render(<BankinBudgetsContainer />);

    // The first two buttons are toggle buttons, then RAV, then Manage, then categories
    // Actually categories are rendered inside BankinBudgetMain -> BankinBudgetGrid

    const categoryNames = screen.getAllByTestId('category-name').map((el) => el.textContent);
    expect(categoryNames[0]).toMatch(/logement/i);
    expect(categoryNames[1]).toMatch(/alimentation/i);
  });

  it('has correct accessibility attributes on toggle buttons', () => {
    render(<BankinBudgetsContainer />);

    const monthlyBtn = screen.getByText('Mois');
    const annualBtn = screen.getByText('Année');

    expect(monthlyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(annualBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
