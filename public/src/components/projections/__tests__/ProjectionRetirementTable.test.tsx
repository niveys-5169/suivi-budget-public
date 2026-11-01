import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ProjectionRetraiteResultat,
  ProjectionRetraiteScenario,
} from '../../../types/banking.types';
import { ProjectionRetirementTable } from '../ProjectionRetirementTable';

const detail = (cnav: number, trimestres: number): ProjectionRetraiteResultat => ({
  detailBrut: { cnav, agircArrco: 400, cipav: 150, per: 100 },
  totalBrut: cnav + 650,
  netAvantImpot: 0,
  trimestres: { regimeGeneral: trimestres, autresRegimes: 0, total: trimestres, manquants: 0 },
  sam: 0,
  anneesRetenues: 25,
  tauxLiquidation: 0.5,
  coefficientProratisation: 1,
  pointsAgircArrco: 0,
  pointsCipav: 0,
});

const scenario = (
  id: string,
  nom: string,
  cnav: number,
  trimestres: number,
  avecDetail = true,
): ProjectionRetraiteScenario => ({
  scenarioId: id,
  nom,
  parPersonne: [
    {
      personneId: 'p1',
      prenom: 'Alex',
      netAvantImpot: 1500,
      netApresImpot: 1400,
      ...(avecDetail ? { detail: detail(cnav, trimestres) } : {}),
    },
  ],
  totalAvantImpot: 1500,
  totalApresImpot: 1400,
  tauxRemplacement: 0.6,
});

const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('ProjectionRetirementTable : détail par régime', () => {
  it('affiche un bloc par personne, une colonne par scénario', () => {
    render(
      <ProjectionRetirementTable
        retraite={[scenario('s1', 'Association', 1000, 168), scenario('s2', 'Libéral', 1200, 172)]}
        anneeReference={2030}
      />,
    );
    expect(screen.getByText('Alex, détail par régime (brut mensuel)')).toBeInTheDocument();
    const cnav = within(rowOf('Alex, CNAV'));
    expect(cnav.getByText(/1\s000/)).toBeInTheDocument();
    expect(cnav.getByText(/1\s200/)).toBeInTheDocument();
    expect(within(rowOf('Alex, Agirc-Arrco')).getAllByText(/400/)).toHaveLength(2);
    expect(within(rowOf('Alex, Cipav')).getAllByText(/150/)).toHaveLength(2);
    expect(within(rowOf('Alex, PER')).getAllByText(/100/)).toHaveLength(2);
    expect(within(rowOf('Alex, total brut')).getByText(/1\s650/)).toBeInTheDocument();
    const trimestres = within(rowOf('Alex, trimestres à la liquidation'));
    expect(trimestres.getByText('168')).toBeInTheDocument();
    expect(trimestres.getByText('172')).toBeInTheDocument();
  });

  it('n’ajoute aucune ligne pour des pensions saisies (sans détail)', () => {
    render(
      <ProjectionRetirementTable
        retraite={[scenario('s1', 'Prudent', 0, 0, false)]}
        anneeReference={2030}
      />,
    );
    expect(screen.queryByText(/détail par régime/)).not.toBeInTheDocument();
    expect(screen.queryByText('Alex, CNAV')).not.toBeInTheDocument();
    expect(screen.getByText('Alex, net après impôt')).toBeInTheDocument();
  });
});
