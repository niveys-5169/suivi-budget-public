import { describe, it, expect } from 'vitest';
import { computeMoisReleves, mergeMoisReels } from '../projection/moisReels';
import { simulateAll } from '../projection/simulateProjection';
import { createDefaultProjectionParams } from '../projection/defaults';
import { makeInputs, makePhase } from './projectionFixtures';
import type {
  ProjectionParams,
  ProjectionPhaseRevenu,
  Transaction,
} from '../../types/banking.types';

function phase(personneId: string, categorie: string): ProjectionPhaseRevenu {
  return {
    id: `p-${personneId}`,
    personneId,
    libelle: 'Salarié',
    debut: '2026-09',
    netMensuel: { mode: 'auto' },
    categoriesSource: [categorie],
    revalorisationAnnuelle: 0,
  };
}

function tx(date: string, categorie: string, montant: number, over: Partial<Transaction> = {}) {
  return {
    id: `${date}-${categorie}-${montant}`,
    date,
    categorie,
    montant,
    ...over,
  } as Transaction;
}

function params(): ProjectionParams {
  const base = createDefaultProjectionParams(new Date(2026, 0, 1));
  return {
    ...base,
    horizon: { debut: '2026-09', fin: '2030-12', anneeReferencePrix: 2026 },
    personnes: [
      { id: 'a', prenom: 'Alice' },
      { id: 'b', prenom: 'Bruno' },
    ],
    revenusCommuns: {
      ...base.revenusCommuns,
      phases: [phase('a', 'Salaire Alice')],
      caf: { ...base.revenusCommuns.caf, categoriesSource: ['CAF'] },
    },
    scenarios: [
      {
        id: 's1',
        nom: 'S1',
        phases: [phase('b', 'Salaire Bruno')],
        pensions: [],
      },
    ],
    classesCategories: { Prime: 'revenu', Remboursement: 'ponctuel', Épargne: 'tresorerie' },
  };
}

const ctx = { revenuCategories: [], creditCategories: [], excludedCategories: ['Exclu'] };

describe('computeMoisReleves', () => {
  const transactions = [
    tx('2026-09-28', 'Salaire Alice', 3000),
    tx('2026-09-28', 'Salaire Bruno', 2800),
    tx('2026-09-05', 'CAF', 150),
    tx('2026-09-10', 'Prime', 400),
    tx('2026-09-12', 'Courses', -600),
    tx('2026-09-15', 'Crédit immo', -1300),
    tx('2026-09-20', 'Remboursement', 80),
    tx('2026-09-21', 'Épargne', -500),
    tx('2026-09-22', 'Exclu', -999),
    tx('2026-09-23', 'Courses', -50, { bankStatus: 'pending' }),
    tx('2026-10-30', 'Salaire Alice', 3100, { moisAffectation: '2026-11' }),
    tx('2026-08-28', 'Salaire Alice', 3000),
  ];

  it('ventile les transactions des mois révolus de l horizon', () => {
    const r = computeMoisReleves({
      transactions,
      params: params(),
      ctx,
      aujourdhui: new Date(2026, 11, 2),
    });
    expect(Object.keys(r).sort()).toEqual(['2026-09', '2026-11']);
    expect(r['2026-09']).toEqual({
      revenusParPersonne: { a: 3000, b: 2800 },
      caf: 150,
      autresRevenus: 400,
      depenses: 1900,
      fluxExceptionnels: 80,
    });
    expect(r['2026-11']?.revenusParPersonne).toEqual({ a: 3100, b: 0 });
  });

  it('ignore le mois courant (incomplet)', () => {
    const r = computeMoisReleves({
      transactions,
      params: params(),
      ctx,
      aujourdhui: new Date(2026, 10, 2),
    });
    expect(Object.keys(r)).toEqual(['2026-09']);
  });
});

describe('mergeMoisReels', () => {
  it('une saisie prime champ par champ sur le relevé', () => {
    const merged = mergeMoisReels(
      { '2026-09': { revenusParPersonne: { a: 3000, b: 2800 }, caf: 150, depenses: 1900 } },
      { '2026-09': { revenusParPersonne: { b: 2500 }, depenses: 2100 }, '2027-01': { caf: 0 } },
    );
    expect(merged['2026-09']).toEqual({
      source: 'manuel',
      valeurs: { revenusParPersonne: { a: 3000, b: 2500 }, caf: 150, depenses: 2100 },
    });
    expect(merged['2027-01']).toEqual({
      source: 'manuel',
      valeurs: { caf: 0, revenusParPersonne: {} },
    });
  });
});

describe('simulateScenario avec mois réalisés', () => {
  it('remplace les montants théoriques et répercute sur le patrimoine', () => {
    const inputs = makeInputs({
      budgetReference: 2000,
      caf: { montant: 100, evolutionAnnuelle: 0 },
      exceptionnelles: [{ id: 'x', libelle: 'Travaux', montant: 5000, mois: '2026-01' }],
      scenarios: [{ id: 's1', nom: 'S1', phases: [makePhase('a', 3000, '2026-01')], pensions: [] }],
      moisReels: {
        '2026-01': {
          source: 'releve',
          valeurs: {
            revenusParPersonne: { a: 3200 },
            caf: 120,
            autresRevenus: 50,
            depenses: 2500,
            fluxExceptionnels: -300,
          },
        },
      },
    });
    const [s] = simulateAll(inputs);
    const [janv, fev] = s!.mois;
    expect(janv).toMatchObject({
      source: 'releve',
      revenus: 3200 + 120 + 50,
      depenses: 2500,
      capacite: 870,
      depensesExceptionnelles: 300,
      encaissements: 0,
      patrimoineTotal: 570,
    });
    expect(fev).toMatchObject({ source: 'theorique', revenus: 3100, depenses: 2000 });
  });
});
