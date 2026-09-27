import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetManagerPanel } from '../../../public/src/components/budgets-v2/BudgetManagerPanel';

const ctx = {
  budgets: [] as Record<string, unknown>[],
  baseBudgets: [] as Record<string, unknown>[],
  viewMode: 'monthly' as 'monthly' | 'annual',
  setViewMode: vi.fn(),
  monthKey: '2026-04',
  updateBaseBudget: vi.fn(),
  updateMonthlyBudget: vi.fn(),
  updateAnnualDefault: vi.fn(),
  removeBudgetCategory: vi.fn(),
  getBudgetCategoryCandidates: () => [],
  convertToMonthly: vi.fn(),
  saveEnvelope: vi.fn(),
};

vi.mock('../../../public/src/context/BudgetContext', () => ({
  useBudgetContext: () => ctx,
}));
vi.mock('../../../public/src/hooks/useBudget', () => ({ useBudget: () => ctx }));
vi.mock('../../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({ transactions: [] }),
}));
vi.mock('../../../public/src/components/budgets-v2/BudgetProjectionBadge', () => ({
  BudgetProjectionBadge: () => null,
}));

const COURSES = {
  id: 'courses',
  categorie: 'Courses',
  nom: 'Courses',
  montant: 400,
  actif: true,
  type: 'mensuel',
};
const VACANCES = {
  id: 'vacances',
  categorie: 'Vacances',
  nom: 'Vacances',
  montant: 3000,
  actif: true,
  type: 'annuel',
  moisAttendus: [7],
};

const kindGroup = (name: string) => screen.getByRole('group', { name: `Type du budget ${name}` });

describe('BudgetManagerPanel — Mensuel / Enveloppe', () => {
  beforeEach(() => {
    ctx.viewMode = 'monthly';
    // Vue mois : le contexte résout l'enveloppe en ÷ 12.
    ctx.budgets = [COURSES, { ...VACANCES, montant: 250 }];
    ctx.baseBudgets = [COURSES, VACANCES];
    for (const fn of [
      ctx.updateBaseBudget,
      ctx.updateAnnualDefault,
      ctx.updateMonthlyBudget,
      ctx.convertToMonthly,
    ]) {
      fn.mockReset().mockResolvedValue(undefined);
    }
  });

  it('affiche le type de chaque budget de dépense', () => {
    render(<BudgetManagerPanel onClose={vi.fn()} />);
    expect(within(kindGroup('Courses')).getByRole('button', { name: 'Mensuel' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(kindGroup('Vacances')).getByRole('button', { name: 'Enveloppe' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('« Mensuel » repasse une enveloppe en budget mensuel (montant ÷ 12)', async () => {
    render(<BudgetManagerPanel onClose={vi.fn()} />);
    fireEvent.click(within(kindGroup('Vacances')).getByRole('button', { name: 'Mensuel' }));
    await waitFor(() => expect(ctx.convertToMonthly).toHaveBeenCalledWith('Vacances', 250));
  });

  it('« Enveloppe » ouvre la fenêtre avec la catégorie et le montant ×12', () => {
    render(<BudgetManagerPanel onClose={vi.fn()} />);
    fireEvent.click(within(kindGroup('Courses')).getByRole('button', { name: 'Enveloppe' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Catégorie/)).toHaveValue('Courses');
    expect(screen.getByLabelText(/Catégorie/)).toBeDisabled();
    expect(screen.getByLabelText(/Montant/)).toHaveValue('4800');
  });

  it('modifier un montant en vue Année ne transforme pas un budget mensuel en enveloppe', async () => {
    ctx.viewMode = 'annual';
    ctx.budgets = [{ ...COURSES, montant: 4800 }];
    ctx.baseBudgets = [COURSES];
    render(<BudgetManagerPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByTitle(/modifier/i)[0]!);
    fireEvent.change(screen.getByDisplayValue('4800'), { target: { value: '6000' } });
    // Le mock global de framer-motion remonte le sous-arbre : on relit le champ.
    fireEvent.keyDown(screen.getByDisplayValue('6000'), { key: 'Enter' });

    await waitFor(() => expect(ctx.updateAnnualDefault).toHaveBeenCalledWith('Courses', 6000));
    expect(ctx.updateBaseBudget).toHaveBeenCalledWith('Courses', 500, 'mensuel', false);
  });
});
