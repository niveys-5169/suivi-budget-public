import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TransactionFormModal } from '../../public/src/components/TransactionFormModal';
import { expandVentilations } from '../../public/src/utils/ventilation';
import type { Transaction } from '../../public/src/types/banking.types';

vi.mock('../../public/src/components/shared/RecurrenceLinkField', () => ({
  RecurrenceLinkField: () => null,
}));

const solde: Transaction = {
  id: 'tx1',
  date: '2026-10-28',
  libelle: 'VIR SOLDE DE TOUT COMPTE',
  montant: 12000,
  compte: 'LCL Courant',
  pointe: false,
  categorie: 'Indemnités de licenciement',
  ventilation: [{ montant: 2450, categorie: 'Salaire', moisAffectation: '2026-10' }],
};

function renderModal(transaction: Transaction, onSave = vi.fn()) {
  render(
    <MemoryRouter>
      <TransactionFormModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        transaction={transaction}
        categories={['Indemnités de licenciement', 'Salaire', 'Épargne']}
        accounts={['LCL Courant']}
      />
    </MemoryRouter>,
  );
  return onSave;
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Certifier' }));

describe('TransactionFormModal — ventilation', () => {
  it('ouverte depuis une part, édite la transaction stockée entière', () => {
    const part = expandVentilations([solde])[1]!;
    renderModal(part);

    expect(screen.getAllByDisplayValue('12000').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('2450')).toBeInTheDocument();
    expect(screen.getByText(/9\s?550,00\s€/)).toBeInTheDocument();
  });

  it('enregistre une nouvelle part signée comme la transaction, sur l’id stocké', async () => {
    const onSave = renderModal({ ...solde, montant: -80, ventilation: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Ventiler une part' }));
    fireEvent.change(screen.getByLabelText('Montant de la part'), { target: { value: '30' } });
    const part = screen.getByLabelText('Montant de la part').closest('div.grid') as HTMLElement;
    fireEvent.change(within(part).getByRole('combobox'), { target: { value: 'Épargne' } });
    submit();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      id: 'tx1',
      montant: -80,
      ventilation: [{ montant: -30, categorie: 'Épargne' }],
    });
  });

  it('retirer toutes les parts efface la ventilation', async () => {
    const onSave = renderModal(solde);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer cette part' }));
    submit();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toMatchObject({ id: 'tx1', ventilation: [] });
  });
});
