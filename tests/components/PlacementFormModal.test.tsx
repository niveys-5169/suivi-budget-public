import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacementFormModal } from '../../public/src/components/PlacementFormModal';

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockResolvedValue(undefined);

vi.mock('../../public/src/hooks/usePlacements', () => ({
  usePlacements: () => ({
    addPlacement: mockAdd,
    updatePlacement: mockUpdate,
    deletePlacement: mockDelete,
  }),
}));

describe("PlacementFormModal — édition d'un placement", () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  it('affiche le snapshot précédent quand previousAmount est fourni et placement non-live', () => {
    render(
      <PlacementFormModal
        placement={{ id: 'abc-123', nom: 'Livret A', type: 'savings', montant: 5000 }}
        previousAmount={{ montant: 4500, date: new Date('2026-03-15') }}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const snapshot = screen.getByText(/Snapshot du 15\/03\/2026/);
    expect(snapshot).toBeInTheDocument();
    expect(snapshot.textContent).toContain('4');
    expect(snapshot.textContent).toContain('500');
  });

  it("n'affiche pas le snapshot quand le placement est live (id préfixé live_pf_)", () => {
    render(
      <PlacementFormModal
        placement={{ id: 'live_pf_xyz', nom: 'Portefeuille Live', type: 'market', montant: 10000 }}
        previousAmount={{ montant: 9000, date: new Date('2026-03-15') }}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByText(/Snapshot du/)).not.toBeInTheDocument();
  });

  it('appelle updatePlacement à la soumission pour un placement existant manuel', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { baseElement } = render(
      <PlacementFormModal
        placement={{ id: 'manual-1', nom: 'PEA', type: 'market', montant: 12000 }}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    const form = baseElement.querySelector('#placement-form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith('manual-1', expect.objectContaining({ nom: 'PEA' }));
      expect(mockAdd).not.toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("appelle addPlacement quand aucun placement n'est fourni (création)", async () => {
    const { baseElement } = render(<PlacementFormModal onClose={() => {}} onSave={() => {}} />);

    const nomInput = screen.getByLabelText(/nom de l'actif/i);
    fireEvent.change(nomInput, { target: { value: 'Nouveau Livret' } });

    const form = baseElement.querySelector('#placement-form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockAdd).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  it("n'appelle pas updatePlacement pour un placement live (preferred no-op via disabled submit)", () => {
    render(
      <PlacementFormModal
        placement={{ id: 'portfolio_aapl', nom: 'AAPL', type: 'market', montant: 200 }}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /enregistrer/i });
    expect(submitBtn).toBeDisabled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
