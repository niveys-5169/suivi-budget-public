import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { BankinBudgetsContainer } from '../BankinBudgetsContainer';
import React from 'react';

// Mock contexts
const mockSetViewMode = vi.fn();
const mockUpdateBudget = vi.fn();
const DEFAULT_BUDGETS = [
  { categorie: 'Logement', montant: 1000, actif: true },
  { categorie: 'Alimentation', montant: 500, actif: true },
];
const DEFAULT_TRANSACTIONS = [
  { id: '1', date: '2026-04-01', libelle: 'Loyer', montant: -1000, categorie: 'Logement' },
  { id: '2', date: '2026-04-10', libelle: 'Courses', montant: -200, categorie: 'Alimentation' },
];
let mockBudgets: Record<string, unknown>[] = DEFAULT_BUDGETS;
let mockBaseBudgets: Record<string, unknown>[] = [];
let mockTransactions: Record<string, unknown>[] = DEFAULT_TRANSACTIONS;

vi.mock('../../../../api/budgets', () => ({
  updateBudget: (...args: unknown[]) => mockUpdateBudget(...args),
}));

vi.mock('../../../../context/BudgetContext', () => ({
  useBudgetContext: () => ({
    budgets: mockBudgets,
    baseBudgets: mockBaseBudgets,
    monthKey: '2026-04',
    setMonthKey: vi.fn(),
    viewMode: 'monthly',
    setViewMode: mockSetViewMode,
  }),
}));

vi.mock('../../../../context/TransactionContext', () => ({
  useTransactionContext: () => ({
    transactions: mockTransactions,
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
  beforeEach(() => {
    mockBudgets = DEFAULT_BUDGETS;
    mockTransactions = DEFAULT_TRANSACTIONS;
    mockBaseBudgets = [];
    mockUpdateBudget.mockReset();
  });

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

  describe('bouton de sens (Auto → Entrée → Sortie)', () => {
    const NOTES_TX = [
      ...DEFAULT_TRANSACTIONS,
      { id: '3', date: '2026-04-12', libelle: 'Remb.', montant: 80, categorie: 'Notes de frais' },
    ];

    it('enregistre le sens même sans budget pour la catégorie', () => {
      mockTransactions = NOTES_TX;
      render(<BankinBudgetsContainer />);

      const card = screen.getByTitle('Notes de frais').closest('[role="button"]') as HTMLElement;
      fireEvent.click(within(card).getByTitle('Auto — clic pour Entrée'));

      expect(mockUpdateBudget).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ categorie: 'Notes de frais', isIncome: true, actif: false }),
      );
    });

    it('applique le sens stocké sur un budget inactif sans réactiver son montant', () => {
      mockTransactions = NOTES_TX;
      mockBudgets = [
        ...DEFAULT_BUDGETS,
        { categorie: 'Notes de frais', montant: 300, actif: false, isIncome: false },
      ];
      render(<BankinBudgetsContainer />);

      // Sens « Sortie » pris en compte : la carte affiche l'état Sortie.
      expect(screen.getByTitle('Sortie — clic pour Auto')).toBeInTheDocument();
      // Budget inactif : son montant n'entre pas dans le budget total (1 500 inchangé).
      expect(screen.getAllByText(/1 500/)[0]).toBeInTheDocument();
      expect(screen.queryByText(/\/ 300/)).not.toBeInTheDocument();
    });
  });

  describe('enveloppes annuelles', () => {
    const VACANCES = {
      categorie: 'Vacances',
      montant: 3000,
      actif: true,
      type: 'annuel',
      moisAttendus: [7],
    };

    beforeEach(() => {
      // Vue mois : le contexte résout l'annuel en ÷ 12.
      mockBudgets = [...DEFAULT_BUDGETS, { ...VACANCES, montant: 250 }];
      mockBaseBudgets = [...DEFAULT_BUDGETS, VACANCES];
      mockTransactions = [
        ...DEFAULT_TRANSACTIONS,
        {
          id: '3',
          date: '2026-04-05',
          libelle: 'Acompte gîte',
          montant: -400,
          categorie: 'Vacances',
        },
      ];
    });

    it('sort les vacances de la grille et les affiche en enveloppe', () => {
      render(<BankinBudgetsContainer />);

      const categoryNames = screen.getAllByTestId('category-name').map((el) => el.textContent);
      expect(categoryNames.some((n) => /vacances/i.test(n ?? ''))).toBe(false);

      expect(screen.getByText('Enveloppes annuelles')).toBeInTheDocument();
      expect(screen.getByText(/400\s€ \/ 3\s000\s€/)).toBeInTheDocument();
      expect(screen.getByText(/Juillet 2026/)).toBeInTheDocument();
    });

    it('garde la provision dans le budget total sans compter l’acompte dans la jauge', () => {
      render(<BankinBudgetsContainer />);

      // Budget total = 1000 + 500 + 250 de provision.
      expect(screen.getAllByText(/1\s750/)[0]).toBeInTheDocument();
      // Restant = 1750 − (1000 + 200), l'acompte de 400 est payé par l'enveloppe.
      expect(screen.getAllByText(/550/)[0]).toBeInTheDocument();
      // Le solde net reste la trésorerie réelle : −1600.
      expect(screen.getAllByText(/1\s600/)[0]).toBeInTheDocument();
    });
  });
});
