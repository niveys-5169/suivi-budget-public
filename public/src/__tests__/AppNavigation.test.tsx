import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MainApp } from '../MainApp';
import React from 'react';

// Mock everything including providers to isolate MainApp
vi.mock('../context/AppStateContext', () => ({
  AppStateProvider: ({ children }: any) => <div data-testid="app-state-provider">{children}</div>,
  useAppState: () => ({}),
}));

vi.mock('../context/TransactionContext', () => ({
  TransactionProvider: ({ children }: any) => (
    <div data-testid="transaction-provider">{children}</div>
  ),
  useTransactionContext: () => ({}),
}));

vi.mock('../context/BudgetContext', () => ({
  BudgetProvider: ({ children }: any) => <div data-testid="budget-provider">{children}</div>,
  useBudgetContext: () => ({}),
}));

// Mock sections
vi.mock('../components/DashboardSection', () => ({
  DashboardSection: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('../components/TransactionsSection', () => ({
  TransactionsSection: () => <div data-testid="transactions">Transactions</div>,
}));
vi.mock('../components/budgets-v2/BudgetsV2Section', () => ({
  BudgetsV2Section: () => <div data-testid="budgets">Budgets</div>,
}));
vi.mock('../components/PatrimoineSection', () => ({
  PatrimoineSection: () => <div data-testid="patrimoine">Patrimoine</div>,
}));
vi.mock('../components/projections/ProjectionsSection', () => ({
  ProjectionsSection: () => <div data-testid="projections">Projections</div>,
}));
vi.mock('../components/analyse/AnalyseSection', () => ({
  AnalyseSection: () => <div data-testid="analyse">Analyse</div>,
}));
vi.mock('../components/FinanceQASection', () => ({
  FinanceQASection: () => <div data-testid="qa">QA</div>,
}));
vi.mock('../components/settings/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings">Settings</div>,
}));

// Mock feature flags (objet mutable : un test coupe ANALYSE_PAGE)
const FLAGS = vi.hoisted(() => ({
  BOTTOMNAV_V2: true,
  ANALYSE_PAGE: true,
  BUDGET_BANKIN: true,
}));
vi.mock('../lib/featureFlags', () => ({ FLAGS }));

describe('App Navigation', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    FLAGS.ANALYSE_PAGE = true;
  });

  it('renders correctly', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MainApp />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  it('rend une page introuvable dans le shell, avec retour au tableau de bord', async () => {
    render(
      <MemoryRouter initialEntries={['/route-inconnue']}>
        <MainApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Page introuvable')).toBeInTheDocument();
    // Le shell reste en place : la page vit dans <main>, pas à la place du layout.
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Page introuvable'));

    fireEvent.click(screen.getByRole('button', { name: 'Retour au tableau de bord' }));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it.each(['/budget', '/budgets-v2'])(
    'redirige l’ancienne route %s vers /budgets',
    async (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <MainApp />
        </MemoryRouter>,
      );

      expect(await screen.findByTestId('budgets')).toBeInTheDocument();
    },
  );

  it('rend la section Projections sur /projections', async () => {
    render(
      <MemoryRouter initialEntries={['/projections']}>
        <MainApp />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('projections')).toBeInTheDocument();
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });

  it('affiche le lien Projections dans la barre latérale', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MainApp />
      </MemoryRouter>,
    );

    const lien = await screen.findByRole('link', { name: 'Projections' });
    expect(lien).toHaveAttribute('href', '/projections');
  });

  it('redirige /analyse vers le tableau de bord quand la page est désactivée', async () => {
    FLAGS.ANALYSE_PAGE = false;
    render(
      <MemoryRouter initialEntries={['/analyse']}>
        <MainApp />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Page introuvable')).toBeNull();
  });
});
