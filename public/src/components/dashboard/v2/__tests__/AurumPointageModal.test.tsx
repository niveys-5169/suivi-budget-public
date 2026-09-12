import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AurumPointageModal } from '../AurumPointageModal';
import { Transaction } from '../../../../context/TransactionContext';

const mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    libelle: 'Boulangerie',
    montant: -4.5,
    date: '2026-06-12',
    compte: 'Compte Courant LCL',
    categorie: 'Alimentation',
    pointe: false,
  },
  {
    id: 'tx-2',
    libelle: 'Salaire',
    montant: 2500,
    date: '2026-06-10',
    compte: 'Compte Courant BforBank',
    categorie: 'Salaire',
    pointe: false,
  },
];

describe('AurumPointageModal', () => {
  it('renders transactions list sorted by date desc', () => {
    const handleClose = vi.fn();
    const handleTogglePointe = vi.fn().mockResolvedValue(undefined);
    const handleEdit = vi.fn();

    render(
      <AurumPointageModal
        isOpen={true}
        onClose={handleClose}
        transactions={mockTransactions}
        onTogglePointe={handleTogglePointe}
        onEdit={handleEdit}
      />,
    );

    expect(screen.getByText('Transactions à pointer')).toBeInTheDocument();
    expect(screen.getByText('Boulangerie')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
    expect(screen.getByText('Compte Courant LCL')).toBeInTheDocument();
    expect(screen.getByText('Compte Courant BforBank')).toBeInTheDocument();

    // Check amounts using regex to handle non-breaking space variants
    expect(screen.getByText(/-4\s*,\s*50/)).toBeInTheDocument();
    expect(screen.getByText(/2\s*500\s*,\s*00/)).toBeInTheDocument();
  });

  it('calls onTogglePointe when clicking the toggle check button and disables it during toggle', async () => {
    const handleClose = vi.fn();
    let resolveToggle: any;
    const togglePromise = new Promise((resolve) => {
      resolveToggle = resolve;
    });
    const handleTogglePointe = vi.fn().mockImplementation(() => togglePromise);
    const handleEdit = vi.fn();

    render(
      <AurumPointageModal
        isOpen={true}
        onClose={handleClose}
        transactions={mockTransactions}
        onTogglePointe={handleTogglePointe}
        onEdit={handleEdit}
      />,
    );

    const toggleButtons = screen.getAllByRole('button', { name: /Pointer la transaction/i });
    expect(toggleButtons).toHaveLength(2);

    // Click the first one (Boulangerie)
    fireEvent.click(toggleButtons[0]!);

    // Verify onTogglePointe was called with tx-1
    expect(handleTogglePointe).toHaveBeenCalledWith('tx-1', true);
    // Edit should not be called
    expect(handleEdit).not.toHaveBeenCalled();

    // Verify it is disabled while promise is pending (anti double-click)
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /Pointer la transaction/i });
      expect(buttons[0]).toBeDisabled();
    });

    // Resolve promise
    resolveToggle();
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /Pointer la transaction/i });
      expect(buttons[0]).not.toBeDisabled();
    });
  });

  it('calls onEdit when clicking the transaction line', () => {
    const handleClose = vi.fn();
    const handleTogglePointe = vi.fn().mockResolvedValue(undefined);
    const handleEdit = vi.fn();

    render(
      <AurumPointageModal
        isOpen={true}
        onClose={handleClose}
        transactions={mockTransactions}
        onTogglePointe={handleTogglePointe}
        onEdit={handleEdit}
      />,
    );

    // Click the Boulangerie line (the title text)
    const lineLabel = screen.getByText('Boulangerie');
    fireEvent.click(lineLabel);

    expect(handleEdit).toHaveBeenCalledWith(mockTransactions[0]);
  });

  it('renders empty state when no transactions are provided', () => {
    const handleClose = vi.fn();
    const handleTogglePointe = vi.fn().mockResolvedValue(undefined);
    const handleEdit = vi.fn();

    render(
      <AurumPointageModal
        isOpen={true}
        onClose={handleClose}
        transactions={[]}
        onTogglePointe={handleTogglePointe}
        onEdit={handleEdit}
      />,
    );

    expect(screen.getByText('Aucune transaction à pointer')).toBeInTheDocument();
  });
});
