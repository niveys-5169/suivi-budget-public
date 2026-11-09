import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TransactionFormModal } from '../../public/src/components/TransactionFormModal';
import type { Transaction } from '../../public/src/types/banking.types';

vi.mock('../../public/src/components/shared/RecurrenceLinkField', () => ({
  RecurrenceLinkField: () => null,
}));

const tx: Transaction = {
  id: 'tx1',
  date: '2026-10-28',
  libelle: 'CB CARREFOUR',
  montant: -42,
  compte: 'LCL Courant',
  pointe: false,
};

const modal = (transaction: Transaction | null) => (
  <MemoryRouter>
    <TransactionFormModal
      isOpen
      onClose={vi.fn()}
      onSave={vi.fn()}
      transaction={transaction}
      categories={[]}
      // Nouveau tableau à chaque rendu, comme beaucoup d'appelants.
      accounts={['LCL Courant']}
    />
  </MemoryRouter>
);

describe('TransactionFormModal — saisie en cours', () => {
  it('garde le libellé saisi quand le parent re-rend la même transaction', () => {
    const { rerender } = render(modal(tx));
    const input = screen.getByDisplayValue('CB CARREFOUR');
    fireEvent.change(input, { target: { value: 'Courses semaine' } });

    // Snapshot Firestore : même transaction, nouvel objet.
    rerender(modal({ ...tx }));

    expect(screen.getByDisplayValue('Courses semaine')).toBeInTheDocument();
  });

  it('recharge le formulaire quand une autre transaction est ouverte', () => {
    const { rerender } = render(modal(tx));
    fireEvent.change(screen.getByDisplayValue('CB CARREFOUR'), { target: { value: 'Brouillon' } });

    rerender(modal({ ...tx, id: 'tx2', libelle: 'PRLV EDF' }));

    expect(screen.getByDisplayValue('PRLV EDF')).toBeInTheDocument();
  });
});
