import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlacementSnapshotModal } from '../../public/src/components/dashboard/v2/PlacementSnapshotModal';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('../../public/src/services/firebase', () => ({ db: {} }));

describe('PlacementSnapshotModal', () => {
  it('ajoute plusieurs lignes et enregistre les snapshots en batch', async () => {
    const placements = [
      { id: 'asset-1', nom: 'Assurance Vie', type: 'other', owner: 'Nicolas', montant: 12000 },
    ];

    render(<PlacementSnapshotModal placements={placements} onClose={vi.fn()} />);

    const addButton = screen.getByRole('button', { name: /Ajouter un snapshot/i });
    fireEvent.click(addButton);

    const removeButtons = screen.getAllByRole('button', { name: /Supprimer/i });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]!);

    const manualButton = screen.getByRole('button', { name: /Saisie libre/i });
    fireEvent.click(manualButton);

    const nameInput = screen.getByPlaceholderText(/ex : Livret A, LEP, Assurance Vie.../i);
    fireEvent.change(nameInput, { target: { value: 'Livret A' } });

    const amountInput = screen.getByPlaceholderText('0');
    fireEvent.change(amountInput, { target: { value: '500' } });

    const saveButton = screen.getByRole('button', { name: /Enregistrer les snapshots/i });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      const updatedButton = screen.getByRole('button', { name: /Snapshots enregistrés ✓/i });
      expect(updatedButton).toBeDisabled();
    });
  });
});
