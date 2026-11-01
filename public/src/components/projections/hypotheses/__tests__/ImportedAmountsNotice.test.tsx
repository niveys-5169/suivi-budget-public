import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectionPension, ProjectionPhaseRevenu } from '../../../../types/banking.types';
import { PensionRow } from '../PensionRow';
import { PhaseRow } from '../PhaseRow';

const personnes = [{ id: 'p1', prenom: 'Alice' }];
const montantsAnnuels = { '2027': 2000, '2028': 2100, '2029': 2200 };
const HELP = /Ces montants priment sur le montant saisi ; effacez-les pour utiliser la saisie\./;

const phase: ProjectionPhaseRevenu = {
  id: 'ph',
  personneId: 'p1',
  libelle: 'Activité',
  debut: '2027-01',
  netMensuel: { mode: 'manuel', manuel: 1800 },
  revalorisationAnnuelle: 0,
};
const pension: ProjectionPension = {
  id: 'pe',
  personneId: 'p1',
  debut: '2040-01',
  netAvantImpot: 1500,
  netApresImpot: 1400,
};
const ctx = {
  observed: null,
  categories: [],
} as unknown as React.ComponentProps<typeof PhaseRow>['ctx'];

describe('Montants annuels importés', () => {
  it('PensionRow : mention, aide et bouton Effacer', () => {
    const onChange = vi.fn();
    render(
      <PensionRow
        pension={{ ...pension, montantsAnnuels }}
        personnes={personnes}
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Montants annuels importés (3 années)')).toBeInTheDocument();
    expect(screen.getByText(HELP)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(onChange).toHaveBeenCalledWith({ montantsAnnuels: undefined });
  });

  it('PhaseRow : mention, aide et bouton Effacer', () => {
    const onChange = vi.fn();
    render(
      <PhaseRow
        phase={{ ...phase, montantsAnnuels }}
        personnes={personnes}
        ctx={ctx}
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Montants annuels importés (3 années)')).toBeInTheDocument();
    expect(screen.getByText(HELP)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(onChange).toHaveBeenCalledWith({ montantsAnnuels: undefined });
  });

  it('rien n est affiché sans montants annuels', () => {
    render(
      <PensionRow pension={pension} personnes={personnes} onChange={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.queryByText(/Montants annuels importés/)).not.toBeInTheDocument();
    expect(screen.queryByText(HELP)).not.toBeInTheDocument();
  });
});
