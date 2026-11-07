import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeeklyRecapPage } from '../WeeklyRecapPage';
import type { WeeklyRecap } from '../../../types/banking.types';

const makeRecap = (
  end: string,
  start: string,
  overrides: Partial<WeeklyRecap> = {},
): WeeklyRecap => ({
  id: end,
  period: { start, end, month: end.slice(0, 7) },
  options: { warning_threshold: 80 },
  balances: {
    accounts: [
      { compte: 'LCL Joint', solde: 1200, status_label: 'Rapproché', status_tone: 'positive' },
    ],
    total: 1200,
    savings_accounts: [],
    total_savings: 0,
  },
  expenses: {
    total_expenses: 46.5,
    categories: [{ categorie: 'Courses', montant: 46.5, pourcentage: 100 }],
    transactions: [
      {
        date: `${end.slice(0, 8)}05`,
        libelle: 'Monoprix',
        montant: 40,
        categorie: 'Courses',
        compte: 'LCL',
      },
      {
        date: `${end.slice(0, 8)}06`,
        libelle: 'Boulangerie',
        montant: 6.5,
        categorie: 'Courses',
        compte: 'LCL',
      },
    ],
    top_transactions: [],
  },
  budgets: {
    variables: [
      {
        categorie: 'Restaurants',
        budget: 100,
        depense: 120,
        pourcentage: 120,
        reste: -20,
        depassement: 20,
        depense_mois_precedent: 60,
        ecart_mois_precedent: 60,
      },
    ],
    exceeded: [],
    warning: [],
    envelopes: [],
  },
  ...overrides,
});

let mockRecaps: WeeklyRecap[] = [];
vi.mock('../../../hooks/useWeeklyRecaps', () => ({
  useWeeklyRecaps: () => ({ recaps: mockRecaps, loading: false }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/semaine/:weekId?" element={<WeeklyRecapPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('WeeklyRecapPage', () => {
  beforeEach(() => {
    const recent = makeRecap('2026-11-07', '2026-11-01');
    mockRecaps = [
      { ...recent, budgets: { ...recent.budgets, exceeded: recent.budgets.variables } },
      makeRecap('2026-10-31', '2026-10-25', {
        expenses: { total_expenses: 24, categories: [], transactions: [], top_transactions: [] },
      }),
    ];
  });

  it('affiche la semaine la plus récente par défaut', () => {
    renderAt('/semaine');
    expect(screen.getByLabelText('Choisir la semaine')).toHaveValue('2026-11-07');
    expect(screen.getByText('1 budget(s) dépassé(s)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeDisabled();
  });

  it('navigue vers la semaine précédente et via le menu déroulant', () => {
    renderAt('/semaine/2026-11-07');
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(screen.getByLabelText('Choisir la semaine')).toHaveValue('2026-10-31');
    expect(screen.getByText('Aucune dépense variable cette semaine.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Choisir la semaine'), {
      target: { value: '2026-11-07' },
    });
    expect(screen.getByLabelText('Choisir la semaine')).toHaveValue('2026-11-07');
  });

  it('déplie une catégorie pour voir ses opérations', () => {
    renderAt('/semaine/2026-11-07');
    expect(screen.queryByText(/Monoprix/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Courses/ }));
    expect(screen.getByText('06/11 · Boulangerie')).toBeInTheDocument();
    expect(screen.getByText('05/11 · Monoprix')).toBeInTheDocument();
  });

  it('déplie les budgets du mois et leur détail', () => {
    renderAt('/semaine/2026-11-07');
    expect(screen.queryByText('Restaurants')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Budgets du mois/ }));
    fireEvent.click(screen.getByRole('button', { name: /Restaurants/ }));
    expect(screen.getByText(/Dépassé de/)).toBeInTheDocument();
    expect(screen.getByText(/Mois précédent à la même date/)).toBeInTheDocument();
  });

  it('signale une semaine inconnue et l’absence de fiche', () => {
    renderAt('/semaine/2020-01-04');
    expect(screen.getByText('Semaine introuvable', { selector: 'h3, p, h2' })).toBeInTheDocument();
    mockRecaps = [];
    renderAt('/semaine');
    expect(screen.getByText('Aucune semaine enregistrée')).toBeInTheDocument();
  });
});
