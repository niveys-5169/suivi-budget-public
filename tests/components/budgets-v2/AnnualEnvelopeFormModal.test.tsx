import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnualEnvelopeFormModal } from '../../../public/src/components/budgets-v2/AnnualEnvelopeFormModal';

const saveEnvelope = vi.fn();
const removeBudgetCategory = vi.fn();
const convertToMonthly = vi.fn();

vi.mock('../../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({ saveEnvelope, removeBudgetCategory, convertToMonthly }),
}));

describe('AnnualEnvelopeFormModal', () => {
  beforeEach(() => {
    saveEnvelope.mockReset().mockResolvedValue(undefined);
    removeBudgetCategory.mockReset().mockResolvedValue(undefined);
    convertToMonthly.mockReset().mockResolvedValue(undefined);
  });

  it('crée une enveloppe en trois champs et affiche la provision', async () => {
    const onClose = vi.fn();
    render(
      <AnnualEnvelopeFormModal isOpen onClose={onClose} categories={['Courses', 'Vacances']} />,
    );

    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Catégorie/), { target: { value: 'Vacances' } });
    fireEvent.change(screen.getByLabelText(/Montant/), { target: { value: '3000' } });
    fireEvent.click(screen.getByRole('button', { name: /juil/i }));

    expect(screen.getByText(/250,00\s€\/mois à mettre de côté/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveEnvelope).toHaveBeenCalledWith('Vacances', 3000, 7);
  });

  it('modifie ou supprime une enveloppe existante', async () => {
    const onClose = vi.fn();
    render(
      <AnnualEnvelopeFormModal
        isOpen
        onClose={onClose}
        categories={['Vacances']}
        envelope={{
          categorie: 'Vacances',
          montant: 3000,
          depense: 400,
          reste: 2600,
          echeanceKey: '2027-07',
          moisEcheance: 7,
          provisionMensuelle: 250,
        }}
      />,
    );

    expect(screen.getByLabelText(/Catégorie/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /juil/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(removeBudgetCategory).toHaveBeenCalledWith('Vacances');
  });

  it('repasse une enveloppe en budget mensuel', async () => {
    const onClose = vi.fn();
    render(
      <AnnualEnvelopeFormModal
        isOpen
        onClose={onClose}
        categories={['Vacances']}
        envelope={{
          categorie: 'Vacances',
          montant: 3000,
          depense: 0,
          reste: 3000,
          echeanceKey: '2027-07',
          moisEcheance: 7,
          provisionMensuelle: 250,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Passer en budget mensuel/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(convertToMonthly).toHaveBeenCalledWith('Vacances', 250);
  });
});
