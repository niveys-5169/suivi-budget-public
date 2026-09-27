import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import { axe } from '../setup';
import { WealthCreditsSection } from '../../public/src/components/WealthCreditsSection';
import type { Credit } from '../../public/src/types/banking.types';

expect.extend(toHaveNoViolations);

const credits: Credit[] = [
  {
    id: 'house',
    nom: 'Crédit Maison',
    owner: 'Commun',
    capitalInitial: 200000,
    tauxAnnuel: 1.5,
    dureeMois: 240,
    dateDebut: '2020-01-01',
  },
  {
    id: 'car',
    nom: 'Crédit voiture',
    owner: 'Commun',
    capitalInitial: 20000,
    tauxAnnuel: 2,
    dureeMois: 36,
    dateDebut: '2024-01-01',
  },
];

const baseProps = {
  credits,
  totalPatrimoine: 300000,
  cashAmount: 10000,
  savingsAmount: 20000,
  investAmount: 15000,
  tauxEndettementFoyer: 0.3,
  onAddCredit: vi.fn(),
  onEditCredit: vi.fn(),
};

describe('WealthCreditsSection', () => {
  it('renders both loans, the net worth KPI and the end-of-loan timeline', () => {
    render(<WealthCreditsSection {...baseProps} />);

    expect(screen.getByText('Crédit Maison')).toBeInTheDocument();
    expect(screen.getByText('Crédit voiture')).toBeInTheDocument();
    // Taux du foyer fourni par la page, affiché tel quel (indépendant des crédits listés).
    expect(screen.getByText('30 %')).toBeInTheDocument();

    // Net worth = totalPatrimoine - total CRD; the KPI card renders it as a
    // plain formatted number, independent of the (mocked) react-intl layer.
    expect(screen.getByText(/Patrimoine net/)).toBeInTheDocument();

    // Timeline: at least one year shows the car loan ending.
    expect(screen.getByText(/Échéancier/)).toBeInTheDocument();
    expect(screen.getAllByText(/Crédit voiture/).length).toBeGreaterThan(1);
  });

  it('shows an empty state and no KPIs when there are no credits', () => {
    render(<WealthCreditsSection {...baseProps} credits={[]} />);
    expect(screen.getByText(/Aucun crédit enregistré/)).toBeInTheDocument();
    expect(screen.queryByText(/Patrimoine net/)).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<WealthCreditsSection {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 30_000);
});
