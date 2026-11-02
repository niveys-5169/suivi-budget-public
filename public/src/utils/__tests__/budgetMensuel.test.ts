import { describe, it, expect } from 'vitest';
import { buildBudgetMensuel } from '../projection/budgetMensuel';
import type { ProjectionMoisResultat } from '../../types/banking.types';

function mois(m: string, over: Partial<ProjectionMoisResultat> = {}): ProjectionMoisResultat {
  return {
    mois: m,
    phase: 'Salarié',
    revenusParPersonne: { a: 3000, b: 2800 },
    caf: 150,
    autresRevenus: 0,
    revenus: 5950,
    creditsFixes: 1300,
    depensesCourantes: 4000,
    depenses: 5300,
    capacite: 650,
    depensesExceptionnelles: 0,
    encaissements: 0,
    remboursementsAnticipes: 0,
    rendementCapital: 10,
    capital: 0,
    prelevementPatrimoine: 0,
    rendementPatrimoine: 5,
    abondement: 0,
    patrimoineHorsPer: 0,
    patrimoineTotal: 100000,
    source: 'theorique',
    ...over,
  };
}

describe('buildBudgetMensuel', () => {
  it('sans regroupement : une ligne par mois, flux exceptionnels nets', () => {
    const lignes = buildBudgetMensuel(
      [
        mois('2026-01'),
        mois('2026-02', {
          encaissements: 500,
          depensesExceptionnelles: 1200,
          remboursementsAnticipes: 300,
        }),
      ],
      false,
    );
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toMatchObject({
      debut: '2026-02',
      fin: '2026-02',
      nbMois: 1,
      fluxExceptionnels: -1000,
      rendements: 15,
    });
  });

  it('regroupe les mois consécutifs aux flux identiques à l euro près', () => {
    const lignes = buildBudgetMensuel(
      [
        mois('2026-01', { patrimoineTotal: 100000 }),
        mois('2026-02', { patrimoineTotal: 100700, capacite: 650.3 }),
        mois('2026-03', { patrimoineTotal: 101400 }),
        mois('2026-04', { phase: 'Congé', capacite: 300, patrimoineTotal: 101700 }),
      ],
      true,
    );
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({
      debut: '2026-01',
      fin: '2026-03',
      nbMois: 3,
      capacite: 650,
      rendements: 45,
      patrimoineFin: 101400,
    });
    expect(lignes[1]).toMatchObject({
      debut: '2026-04',
      fin: '2026-04',
      nbMois: 1,
      phase: 'Congé',
    });
  });

  it('ne regroupe pas des mois non consécutifs ni un mois à flux exceptionnel', () => {
    const lignes = buildBudgetMensuel(
      [mois('2026-01'), mois('2026-02', { encaissements: 40000 }), mois('2026-03')],
      true,
    );
    expect(lignes.map((l) => l.nbMois)).toEqual([1, 1, 1]);
  });

  it('ne regroupe pas un mois relevé avec un mois théorique identique', () => {
    const lignes = buildBudgetMensuel(
      [mois('2026-01', { source: 'releve' }), mois('2026-02')],
      true,
    );
    expect(lignes.map((l) => l.source)).toEqual(['releve', 'theorique']);
  });

  it('distingue les revenus de chaque personne', () => {
    const lignes = buildBudgetMensuel(
      [mois('2026-01'), mois('2026-02', { revenusParPersonne: { a: 2800, b: 3000 } })],
      true,
    );
    expect(lignes).toHaveLength(2);
  });
});
