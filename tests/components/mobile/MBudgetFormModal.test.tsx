import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MBudgetFormModal } from '../../../public/src/mobile/components/MBudgetFormModal';

const createBudget = vi.fn();
const updateBudget = vi.fn();

vi.mock('../../../public/src/api/budgets', () => ({
  createBudget: (...a: unknown[]) => createBudget(...a),
  updateBudget: (...a: unknown[]) => updateBudget(...a),
}));

describe('MBudgetFormModal — Mensuel / Enveloppe', () => {
  beforeEach(() => {
    createBudget.mockReset().mockResolvedValue(undefined);
    updateBudget.mockReset().mockResolvedValue(undefined);
  });

  it('enregistre une enveloppe avec le mois de l’événement', async () => {
    const onSave = vi.fn();
    render(
      <MBudgetFormModal
        categoryName="Vacances"
        currentBudget={{
          id: 'vacances',
          categorie: 'Vacances',
          nom: 'Vacances',
          montant: 250,
          actif: true,
          type: 'mensuel',
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enveloppe' }));
    expect(screen.getByText(/pour l'année/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /juil/i }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(updateBudget).toHaveBeenCalledWith(
      'vacances',
      expect.objectContaining({ type: 'annuel', moisAttendus: [7] }),
    );
  });

  it('exige le mois pour une enveloppe', async () => {
    render(<MBudgetFormModal categoryName="Impôts" onClose={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enveloppe' }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(await screen.findByText("Choisis le mois de l'événement")).toBeInTheDocument();
    expect(createBudget).not.toHaveBeenCalled();
  });
});
