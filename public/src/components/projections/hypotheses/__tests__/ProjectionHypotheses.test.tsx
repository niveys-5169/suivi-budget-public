import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectionHypotheses } from '../ProjectionHypotheses';
import { importSimulationXlsx } from '../../../../utils/projection/importSimulationXlsx';
import { toast } from '../../../../lib/toast';
import { makeParams, makeProjection } from './fixtures';

vi.mock('../../../../utils/projection/importSimulationXlsx', () => ({
  importSimulationXlsx: vi.fn(),
}));
vi.mock('../../../../lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const setup = () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const params = makeParams();
  render(<ProjectionHypotheses projection={makeProjection(params, save)} />);
  return { save, params, user: userEvent.setup() };
};
const open = (user: ReturnType<typeof userEvent.setup>, title: RegExp) =>
  user.click(screen.getByRole('button', { name: title }));

beforeEach(() => vi.clearAllMocks());

describe('ProjectionHypotheses', () => {
  it("enregistre le brouillon après modification d'une phase", async () => {
    const { save, params, user } = setup();
    expect(screen.queryByText('Modifications non enregistrées')).not.toBeInTheDocument();
    await open(user, /Scénarios et revenus/);

    const libelle = screen.getByLabelText('Libellé de la phase');
    await user.clear(libelle);
    await user.type(libelle, 'Activité réduite');
    const reval = screen.getByLabelText('Revalorisation annuelle (%)');
    await user.clear(reval);
    await user.type(reval, '2');

    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]![0];
    expect(saved.scenarios[0].phases[0]).toMatchObject({
      libelle: 'Activité réduite',
      revalorisationAnnuelle: 0.02,
    });
    expect(params.scenarios[0]!.phases[0]!.libelle).toBe('Activité');
    expect(toast.success).toHaveBeenCalled();
  });

  it("signale une erreur d'enregistrement", async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ProjectionHypotheses projection={makeProjection(makeParams(), save)} />);
    const user = userEvent.setup();
    await open(user, /Macro/);
    await user.type(screen.getByLabelText('Inflation annuelle (%)'), '1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(toast.error).toHaveBeenCalled();
  });

  it('annule les modifications', async () => {
    const { save, user } = setup();
    await open(user, /Macro/);
    const inflation = screen.getByLabelText('Inflation annuelle (%)');
    expect(inflation).toHaveValue('2');
    await user.clear(inflation);
    await user.type(inflation, '5');
    await user.click(screen.getByRole('button', { name: 'Annuler les modifications' }));
    expect(screen.getByLabelText('Inflation annuelle (%)')).toHaveValue('2');
    expect(screen.queryByText('Modifications non enregistrées')).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('ajoute puis supprime une dépense exceptionnelle', async () => {
    const { save, user } = setup();
    await open(user, /Dépenses et crédits/);

    await user.click(screen.getByRole('button', { name: 'Ajouter une dépense exceptionnelle' }));
    const libelles = screen.getAllByLabelText('Libellé');
    expect(libelles).toHaveLength(2);
    await user.type(libelles[1]!, 'Voiture');
    await user.type(screen.getAllByLabelText('Montant (€)')[1]!, '5000');
    await user.click(screen.getByRole('button', { name: 'Supprimer Toiture' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    const saved = save.mock.calls[0]![0];
    expect(saved.depenses.exceptionnelles).toEqual([
      expect.objectContaining({ libelle: 'Voiture', montant: 5000, mois: '2026-01' }),
    ]);
  });

  it("change la classe d'une catégorie", async () => {
    const { save, user } = setup();
    await open(user, /Dépenses et crédits/);
    await user.selectOptions(screen.getByLabelText('Classe de Courses'), 'Exclu');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save.mock.calls[0]![0].classesCategories).toEqual({ Courses: 'exclu' });
  });

  it('importe un classeur : aperçu puis application au brouillon', async () => {
    const { save, params, user } = setup();
    const imported = { ...params, macro: { ...params.macro, inflation: 0.035 } };
    vi.mocked(importSimulationXlsx).mockResolvedValue({
      params: imported,
      reconnus: ['Inflation', 'Rendement', 'Horizon'],
      avertissements: ['Onglet « Calc S2 » introuvable'],
    });
    const file = new File(['x'], 'simulation.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });

    await user.upload(screen.getByLabelText('Fichier de simulation (.xlsx)'), file);

    expect(importSimulationXlsx).toHaveBeenCalledWith(expect.any(ArrayBuffer), params);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('3 paramètres reconnus')).toBeInTheDocument();
    expect(within(dialog).getByText('Onglet « Calc S2 » introuvable')).toBeInTheDocument();
    expect(within(dialog).getByText('Phases de revenu').nextSibling).toHaveTextContent('1');
    expect(save).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Appliquer au brouillon' }));
    expect(screen.getByText('Modifications non enregistrées')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(save).toHaveBeenCalledWith(imported);
  });

  it("annule l'aperçu sans modifier le brouillon", async () => {
    const { params, user } = setup();
    vi.mocked(importSimulationXlsx).mockResolvedValue({
      params,
      reconnus: [],
      avertissements: [],
    });
    const file = new File(['x'], 'simulation.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    await user.upload(screen.getByLabelText('Fichier de simulation (.xlsx)'), file);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Modifications non enregistrées')).not.toBeInTheDocument();
  });

  it('signale un fichier illisible', async () => {
    const { user } = setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(importSimulationXlsx).mockRejectedValue(new Error('bad'));
    const file = new File(['x'], 'simulation.xlsx');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    await user.upload(screen.getByLabelText('Fichier de simulation (.xlsx)'), file);
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
