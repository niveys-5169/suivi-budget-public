import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertyFormModal } from '../../public/src/components/property/PropertyFormModal';
import type { Placement } from '../../public/src/hooks/usePlacements';

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

vi.mock('../../public/src/hooks/useCredits', () => ({
  useCredits: () => ({
    credits: [
      { id: 'c1', nom: 'Crédit maison', capitalInitial: 200000, tauxAnnuel: 1.5, dureeMois: 240 },
    ],
  }),
}));

const existing: Placement = {
  id: 'bien-1',
  nom: 'Appartement Nantes',
  owner: 'Nicolas',
  type: 'immobilier',
  montant: 312000,
  modeValorisation: 'estime',
  creditId: 'c1',
  bien: {
    adresse: '10 rue de la Paix',
    codePostal: '44000',
    ville: 'Nantes',
    nature: 'appartement',
    surface: 65,
    pieces: 3,
    etage: 2,
    nbEtages: 5,
    ascenseur: true,
    garages: 0,
    parkings: 1,
    jardin: false,
    terrasse: false,
    balcon: true,
    prixAchat: 250000,
    codeInsee: '44109',
    lat: 47.2,
    lon: -1.55,
    scoreGeocodage: 0.91,
  },
};

const setup = (placement?: Placement) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(<PropertyFormModal placement={placement} onSave={onSave} onClose={onClose} />);
  const form = screen.getByRole('form');
  return { form, onSave, onClose };
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('PropertyFormModal', () => {
  beforeEach(() => {
    mockAdd.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
  });

  it('refuse un formulaire vide et affiche les erreurs de validation', async () => {
    const { form } = setup();
    fireEvent.submit(form);

    expect(await screen.findByText('Nom du bien requis')).toBeInTheDocument();
    expect(screen.getByText('Adresse requise')).toBeInTheDocument();
    expect(screen.getByText('Code postal invalide (5 chiffres)')).toBeInTheDocument();
    expect(screen.getByText('Ville requise')).toBeInTheDocument();
    expect(screen.getByText('La surface doit être > 0')).toBeInTheDocument();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('crée un bien estimé automatiquement', async () => {
    const { form, onSave, onClose } = setup();
    type('Nom du bien', 'Studio Rennes');
    type('Adresse', '5 place du Parlement');
    type('Code postal', '35000');
    type('Ville', 'Rennes');
    type('Surface (m²)', '28,5');
    type("Prix d'achat (€)", '150000');
    fireEvent.submit(form);

    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockUpdate).not.toHaveBeenCalled();
    const payload = mockAdd.mock.calls[0]![0];
    expect(payload).toMatchObject({
      nom: 'Studio Rennes',
      owner: 'Nicolas',
      type: 'immobilier',
      modeValorisation: 'estime',
      montant: 150000, // coût d'achat en attendant la première estimation
      creditId: '',
      bien: {
        adresse: '5 place du Parlement',
        codePostal: '35000',
        ville: 'Rennes',
        nature: 'appartement',
        surface: 28.5,
        prixAchat: 150000,
      },
    });
    expect(payload.bien).not.toHaveProperty('codeInsee');
    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('exige une valeur en mode manuel', async () => {
    setup(existing);
    expect(screen.queryByLabelText('Valeur du bien (€)')).not.toBeInTheDocument();

    type('Mode de valorisation', 'manuel');
    expect(screen.getByLabelText('Valeur du bien (€)')).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('form'));

    expect(await screen.findByText('Valeur requise en mode manuel')).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();

    type('Valeur du bien (€)', '295000');
    fireEvent.submit(screen.getByRole('form'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0]![1]).toMatchObject({
      modeValorisation: 'manuel',
      montant: 295000,
    });
  });

  it('met à jour un bien existant en gardant le cache de géocodage et la valeur estimée', async () => {
    const { form } = setup(existing);
    expect(screen.getByLabelText('Nom du bien')).toHaveValue('Appartement Nantes');
    expect(screen.getByLabelText('Crédit associé')).toHaveValue('c1');

    fireEvent.submit(form);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [id, payload] = mockUpdate.mock.calls[0]!;
    expect(id).toBe('bien-1');
    expect(payload.montant).toBe(312000);
    expect(payload.creditId).toBe('c1');
    expect(payload.bien).toMatchObject({ codeInsee: '44109', lat: 47.2, lon: -1.55 });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("vide le cache de géocodage quand l'adresse change", async () => {
    const { form } = setup(existing);
    type('Ville', 'Rezé');
    fireEvent.submit(form);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const bien = mockUpdate.mock.calls[0]![1].bien;
    expect(bien.ville).toBe('Rezé');
    expect(bien).not.toHaveProperty('codeInsee');
    expect(bien).not.toHaveProperty('lat');
  });

  it('adapte les champs à la nature du bien', () => {
    setup();
    expect(screen.getByLabelText('Étage (0 = rez-de-chaussée)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Terrain (m²)')).not.toBeInTheDocument();

    type('Nature', 'maison');
    expect(screen.getByLabelText('Terrain (m²)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Étage (0 = rez-de-chaussée)')).not.toBeInTheDocument();
  });

  it('propose les crédits existants et « Aucun »', () => {
    setup();
    const select = screen.getByLabelText('Crédit associé') as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(['Aucun', 'Crédit maison']);
  });
});
