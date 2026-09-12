import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WealthEvolutionBudgetChart } from '../../public/src/components/WealthEvolutionBudgetChart';

// Mock Recharts ResponsiveContainer to render children
vi.mock('recharts', async () => {
  const original = (await vi.importActual('recharts')) as any;
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  };
});

describe('WealthEvolutionBudgetChart', () => {
  const mockHistory = [
    { date: '2023-12-31', type: 'savings', montant: 5000, owner: 'Nicolas' },
    { date: '2024-01-15', type: 'savings', montant: 6000, owner: 'Nicolas' },
    { date: '2024-02-01', type: 'market', montant: 10000, owner: 'Nicolas' },
    { date: '2024-03-01', type: 'savings', montant: 8000, owner: 'Nicolas' },
    { date: '2026-06-04', type: 'savings', montant: 12000, owner: 'Nicolas' },
  ];

  const defaultProps = {
    history: mockHistory,
    owners: ['Nicolas'],
    selectedOwners: [],
    onOwnersChange: vi.fn(),
    selectedTypes: [],
    onTypesChange: vi.fn(),
  };

  it('renders title and by default has filters collapsed', () => {
    render(<WealthEvolutionBudgetChart {...defaultProps} />);
    expect(screen.getByText(/Évolution Patrimoine/i)).toBeInTheDocument();

    // Filters should not be visible initially
    expect(screen.queryByText(/Propriétaires/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Types de positions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 Mois/i)).not.toBeInTheDocument();
  });

  it('toggles filter panel when clicking the Filtres button', () => {
    render(<WealthEvolutionBudgetChart {...defaultProps} />);
    const toggleBtn = screen.getByRole('button', { name: /Filtres/i });

    // Expand filters
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Propriétaires/i)).toBeInTheDocument();
    expect(screen.getByText(/Types de positions/i)).toBeInTheDocument();
    expect(screen.getByText(/Période/i)).toBeInTheDocument();

    // Collapse filters
    fireEvent.click(toggleBtn);
    expect(screen.queryByText(/Propriétaires/i)).not.toBeInTheDocument();
  });

  it('shows custom date inputs only when Perso option is clicked', () => {
    render(<WealthEvolutionBudgetChart {...defaultProps} />);
    const toggleBtn = screen.getByRole('button', { name: /Filtres/i });
    fireEvent.click(toggleBtn);

    // Custom inputs should not be visible initially
    expect(screen.queryByLabelText(/Date de début/i)).not.toBeInTheDocument();

    // Click Perso
    const persoBtn = screen.getByRole('button', { name: /Perso/i });
    fireEvent.click(persoBtn);

    expect(screen.getByLabelText(/Date de début/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de fin/i)).toBeInTheDocument();
  });
});
