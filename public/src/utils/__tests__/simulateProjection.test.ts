import { describe, it, expect } from 'vitest';
import { simulateAll, simulateScenario } from '../projection/simulateProjection';
import type { ProjectionInputs } from '../../types/banking.types';
import { makeInputs, makePension, makePhase } from './projectionFixtures';

function run(inputs: ProjectionInputs) {
  const scenario = inputs.scenarios[0];
  if (!scenario) throw new Error('scénario manquant');
  return simulateScenario(inputs, scenario).mois;
}

describe('simulateScenario : revenus et phases', () => {
  it('phase simple sans inflation : revenus, capacité et capital cumulé', () => {
    const inputs = makeInputs({
      phasesCommunes: [makePhase('b', 1500, '2026-01')],
      budgetReference: 2500,
      scenarios: [
        {
          id: 's1',
          nom: 'S1',
          phases: [makePhase('a', 2000, '2026-01', { fin: '2026-02', libelle: 'Salarié' })],
          pensions: [],
        },
      ],
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.mois)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(mois.map((m) => m.revenus)).toEqual([3500, 3500, 1500]);
    expect(mois.map((m) => m.depenses)).toEqual([2500, 2500, 2500]);
    expect(mois.map((m) => m.capacite)).toEqual([1000, 1000, -1000]);
    expect(mois.map((m) => m.capital)).toEqual([1000, 2000, 1000]);
    expect(mois.map((m) => m.phase)).toEqual(['Salarié', 'Salarié', '—']);
    expect(mois[0]?.revenusParPersonne).toEqual({ a: 2000, b: 1500 });
    expect(mois[2]?.revenusParPersonne).toEqual({ a: 0, b: 1500 });
  });

  it('additionne phases communes et phases de scénario d une même personne', () => {
    const inputs = makeInputs({
      phasesCommunes: [makePhase('a', 300, '2026-01')],
      scenarios: [{ id: 's1', nom: 'S1', phases: [makePhase('a', 700, '2026-01')], pensions: [] }],
    });
    expect(run(inputs)[0]?.revenusParPersonne.a).toBe(1000);
  });

  it('indexe au 1er janvier : revalorisation des phases et inflation des dépenses', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-11', fin: '2027-02', anneeReferencePrix: 2026 },
      macro: { inflation: 0.1, rendementCapital: 0, rendementPatrimoine: 0 },
      budgetReference: 500,
      scenarios: [
        {
          id: 's1',
          nom: 'S1',
          phases: [makePhase('a', 1000, '2026-11', { revalorisationAnnuelle: 0.05 })],
          pensions: [],
        },
      ],
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.revenus)).toEqual([1000, 1000, 1050, 1050]);
    expect(mois[0]?.depensesCourantes).toBe(500);
    expect(mois[1]?.depensesCourantes).toBe(500);
    expect(mois[2]?.depensesCourantes).toBeCloseTo(550, 6);
    expect(mois[3]?.depensesCourantes).toBeCloseTo(550, 6);
  });

  it('montantsAnnuels prime sur netMensuel × revalorisation, repli sur le calcul sinon', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-12', fin: '2028-01', anneeReferencePrix: 2026 },
      scenarios: [
        {
          id: 's1',
          nom: 'S1',
          phases: [
            makePhase('a', 1000, '2026-12', {
              revalorisationAnnuelle: 0.1,
              montantsAnnuels: { '2027': 1234 },
            }),
          ],
          pensions: [{ ...makePension('b', 500, '2026-12'), montantsAnnuels: { '2028': 777 } }],
        },
      ],
    });
    const mois = run(inputs);
    const revenusA = mois.map((m) => m.revenusParPersonne['a']);
    expect(revenusA.slice(0, 13)).toEqual([1000, ...Array(12).fill(1234)]);
    expect(revenusA[13]).toBeCloseTo(1210, 6);
    expect(mois.map((m) => m.revenusParPersonne['b'])).toEqual([500, ...Array(12).fill(500), 777]);
  });

  it('inflation avant l année de référence : indice inférieur à 1', () => {
    const inputs = makeInputs({
      horizon: { debut: '2025-12', fin: '2026-01', anneeReferencePrix: 2026 },
      macro: { inflation: 0.1, rendementCapital: 0, rendementPatrimoine: 0 },
      budgetReference: 1100,
    });
    const mois = run(inputs);
    expect(mois[0]?.depensesCourantes).toBeCloseTo(1000, 6);
    expect(mois[1]?.depensesCourantes).toBeCloseTo(1100, 6);
  });

  it('pension indexée sur l inflation ; seule une pension de scénario donne la phase Retraite', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-12', fin: '2028-01', anneeReferencePrix: 2026 },
      macro: { inflation: 0.02, rendementCapital: 0, rendementPatrimoine: 0 },
      pensionsCommunes: [makePension('b', 500, '2026-12')],
      scenarios: [
        { id: 's1', nom: 'S1', phases: [], pensions: [makePension('a', 1000, '2027-01')] },
      ],
    });
    const mois = run(inputs);
    expect(mois[0]?.revenusParPersonne).toEqual({ a: 0, b: 500 });
    expect(mois[0]?.phase).toBe('—');
    expect(mois[1]?.mois).toBe('2027-01');
    expect(mois[1]?.revenusParPersonne.a).toBeCloseTo(1020, 6);
    expect(mois[1]?.revenusParPersonne.b).toBeCloseTo(510, 6);
    expect(mois[1]?.phase).toBe('Retraite');
    expect(mois[13]?.mois).toBe('2028-01');
    expect(mois[13]?.revenusParPersonne.a).toBeCloseTo(1040.4, 6);
  });

  it('CAF indexée selon son évolution annuelle puis arrêtée après dernierMois', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-12', fin: '2027-03', anneeReferencePrix: 2026 },
      caf: { montant: 100, evolutionAnnuelle: 0.02, dernierMois: '2027-01' },
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.caf)).toEqual([100, 102, 0, 0]);
    expect(mois.map((m) => m.revenus)).toEqual([100, 102, 0, 0]);
  });
});

describe('simulateScenario : crédits et dépenses', () => {
  it('fin de crédit : la mensualité s arrête, les dépenses courantes = budget − crédits actifs au départ', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-01', fin: '2026-04', anneeReferencePrix: 2026 },
      budgetReference: 1000,
      credits: [{ id: 'c1', libelle: 'Crédit', mensualite: 300, fin: '2026-02', tauxAnnuel: 0 }],
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.creditsFixes)).toEqual([300, 300, 0, 0]);
    expect(mois.map((m) => m.depensesCourantes)).toEqual([700, 700, 700, 700]);
    expect(mois.map((m) => m.depenses)).toEqual([1000, 1000, 700, 700]);
  });

  it('crédit sans fin : payé pendant tout l horizon', () => {
    const inputs = makeInputs({
      credits: [{ id: 'c1', libelle: 'Crédit', mensualite: 200, tauxAnnuel: 0 }],
    });
    expect(run(inputs).map((m) => m.creditsFixes)).toEqual([200, 200, 200]);
  });

  it('remboursement anticipé à taux > 0 : sortie = valeur actuelle des mensualités restantes + frais', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-01', fin: '2026-06', anneeReferencePrix: 2026 },
      capitalInitial: 10000,
      budgetReference: 100,
      credits: [
        {
          id: 'c1',
          libelle: 'Crédit',
          mensualite: 100,
          fin: '2026-06',
          tauxAnnuel: 12,
          remboursementAnticipe: { mois: '2026-03', frais: 50 },
        },
      ],
    });
    const mois = run(inputs);
    // 3 mensualités restantes (avril, mai, juin) à 1 %/mois : 100 × (1 − 1,01^-3) / 0,01 = 294,0985
    expect(mois[2]?.remboursementsAnticipes).toBeCloseTo(344.0985, 3);
    expect(mois.map((m) => m.remboursementsAnticipes).filter((v) => v > 0)).toHaveLength(1);
    expect(mois.map((m) => m.creditsFixes)).toEqual([100, 100, 100, 0, 0, 0]);
    expect(mois[2]?.capital).toBeCloseTo(10000 - 300 - 344.0985, 3);
  });

  it('remboursement anticipé à taux 0 : mensualité × mois restants, sans frais', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-01', fin: '2026-06', anneeReferencePrix: 2026 },
      credits: [
        {
          id: 'c1',
          libelle: 'Crédit',
          mensualite: 100,
          fin: '2026-06',
          tauxAnnuel: 0,
          remboursementAnticipe: { mois: '2026-03' },
        },
      ],
    });
    expect(run(inputs)[2]?.remboursementsAnticipes).toBe(300);
  });

  it('dépense exceptionnelle et encaissement ponctuel passent par le capital sans toucher la capacité', () => {
    const inputs = makeInputs({
      capitalInitial: 1000,
      exceptionnelles: [{ id: 'e1', libelle: 'Travaux', montant: 500, mois: '2026-02' }],
      encaissements: [{ id: 'i1', libelle: 'Indemnité', montant: 2000, mois: '2026-03' }],
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.depensesExceptionnelles)).toEqual([0, 500, 0]);
    expect(mois.map((m) => m.encaissements)).toEqual([0, 0, 2000]);
    expect(mois.map((m) => m.capacite)).toEqual([0, 0, 0]);
    expect(mois.map((m) => m.capital)).toEqual([1000, 500, 2500]);
  });
});

describe('simulateScenario : capital et patrimoine', () => {
  it('capital épuisé puis déficit prélevé sur le patrimoine hors PER', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-01', fin: '2026-04', anneeReferencePrix: 2026 },
      capitalInitial: 1000,
      patrimoineDepart: 5000,
      budgetReference: 600,
    });
    const mois = run(inputs);
    expect(mois.map((m) => m.capital)).toEqual([400, 0, 0, 0]);
    expect(mois.map((m) => m.prelevementPatrimoine)).toEqual([0, 200, 600, 600]);
    expect(mois.map((m) => m.patrimoineHorsPer)).toEqual([5000, 4800, 4200, 3600]);
    expect(mois.map((m) => m.patrimoineTotal)).toEqual([5400, 4800, 4200, 3600]);
  });

  it('rendement du capital : composé mensuellement, nul au 1er mois', () => {
    const inputs = makeInputs({
      macro: { inflation: 0, rendementCapital: 0.12, rendementPatrimoine: 0 },
      capitalInitial: 10000,
    });
    const mois = run(inputs);
    const tauxMensuel = Math.pow(1.12, 1 / 12) - 1;
    expect(mois[0]?.rendementCapital).toBe(0);
    expect(mois[0]?.capital).toBe(10000);
    expect(mois[1]?.rendementCapital).toBeCloseTo(10000 * tauxMensuel, 6);
    expect(mois[2]?.capital).toBeCloseTo(10000 * Math.pow(1.12, 2 / 12), 6);
  });

  it('rendement du patrimoine hors PER : composé, nul au 1er mois, appliqué même si négatif', () => {
    const inputs = makeInputs({
      macro: { inflation: 0, rendementCapital: 0, rendementPatrimoine: 0.12 },
      patrimoineDepart: 1000,
      budgetReference: 0,
    });
    const mois = run(inputs);
    expect(mois[0]?.rendementPatrimoine).toBe(0);
    expect(mois[2]?.patrimoineHorsPer).toBeCloseTo(1000 * Math.pow(1.12, 2 / 12), 6);

    const negatif = run(
      makeInputs({
        macro: { inflation: 0, rendementCapital: 0, rendementPatrimoine: 0.12 },
        budgetReference: 100,
      }),
    );
    const tauxMensuel = Math.pow(1.12, 1 / 12) - 1;
    expect(negatif[0]?.patrimoineHorsPer).toBe(-100);
    expect(negatif[1]?.rendementPatrimoine).toBeCloseTo(-100 * tauxMensuel, 6);
    expect(negatif[1]?.patrimoineHorsPer).toBeCloseTo(-200 - 100 * tauxMensuel, 6);
  });

  it('abondement versé au bon mois calendaire, et arrêté après finMois', () => {
    const horizon = { debut: '2026-01', fin: '2028-12', anneeReferencePrix: 2026 };
    const avecFin = run(
      makeInputs({
        horizon,
        abondement: { montantAnnuel: 1000, mois: 3, finMois: '2027-03' },
      }),
    );
    const verses = avecFin.filter((m) => m.abondement > 0).map((m) => m.mois);
    expect(verses).toEqual(['2026-03', '2027-03']);
    expect(avecFin[2]?.patrimoineHorsPer).toBe(1000);
    expect(avecFin[35]?.patrimoineHorsPer).toBe(2000);

    const sansFin = run(makeInputs({ horizon, abondement: { montantAnnuel: 1000, mois: 3 } }));
    expect(sansFin.filter((m) => m.abondement > 0).map((m) => m.mois)).toEqual([
      '2026-03',
      '2027-03',
      '2028-03',
    ]);
    expect(sansFin[35]?.patrimoineTotal).toBe(3000);
  });
});

describe('simulateAll', () => {
  it('produit un résultat par scénario avec son id et son nom', () => {
    const inputs = makeInputs({
      scenarios: [
        { id: 's1', nom: 'Bas', phases: [makePhase('a', 1000, '2026-01')], pensions: [] },
        { id: 's2', nom: 'Haut', phases: [makePhase('a', 2000, '2026-01')], pensions: [] },
      ],
    });
    const resultats = simulateAll(inputs);
    expect(resultats.map((r) => [r.scenarioId, r.nom])).toEqual([
      ['s1', 'Bas'],
      ['s2', 'Haut'],
    ]);
    expect(resultats[0]?.mois[0]?.revenus).toBe(1000);
    expect(resultats[1]?.mois[0]?.revenus).toBe(2000);
  });

  it('horizon inversé : aucun mois simulé', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-05', fin: '2026-01', anneeReferencePrix: 2026 },
    });
    expect(simulateAll(inputs)[0]?.mois).toEqual([]);
  });
});
