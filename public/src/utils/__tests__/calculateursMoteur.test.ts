import { describe, expect, it } from 'vitest';
import type { ProjectionRetraiteResultat } from '../../types/banking.types';
import { monthlyIncome } from '../projection/projectionIncome';
import { buildProjectionReport } from '../projection/projectionReport';
import { simulateScenario } from '../projection/simulateProjection';
import { makeInputs, makePension, makePhase } from './projectionFixtures';

const DETAIL: ProjectionRetraiteResultat = {
  detailBrut: { cnav: 1000, agircArrco: 500, cipav: 200, per: 100 },
  totalBrut: 1800,
  netAvantImpot: 1650,
  trimestres: { regimeGeneral: 160, autresRegimes: 12, total: 172, manquants: 0 },
  sam: 30000,
  anneesRetenues: 25,
  tauxLiquidation: 0.5,
  coefficientProratisation: 1,
  pointsAgircArrco: 4000,
  pointsCipav: 300,
};

/** Entrées : « a » est calculée (cash fourni pour janvier et février), « b » reste en phases saisies. */
function inputsCalcules() {
  const inputs = makeInputs({
    phasesCommunes: [makePhase('a', 999, '2026-01'), makePhase('b', 500, '2026-01')],
    pensionsCommunes: [makePension('a', 777, '2026-01')],
  });
  inputs.scenarios = [
    {
      id: 's1',
      nom: 'Calculé',
      phases: [makePhase('a', 888, '2026-01', { libelle: 'Phase saisie' })],
      pensions: [makePension('a', 666, '2026-01')],
      revenusMensuels: { a: { '2026-01': 3000, '2026-02': 1000 } },
      phasesMensuelles: { '2026-01': 'Association', '2026-02': 'Retraite' },
    },
  ];
  return inputs;
}

describe('monthlyIncome avec revenus calculés', () => {
  it('le cash calculé remplace phases et pensions de la personne, communes et du scénario', () => {
    const inputs = inputsCalcules();
    const janvier = monthlyIncome(inputs, inputs.scenarios[0]!, '2026-01');
    expect(janvier.activite).toEqual({ a: 3000, b: 500 });
    expect(janvier.pension).toEqual({ a: 0, b: 0 });
    expect(janvier.phase).toBe('Association');
    expect(monthlyIncome(inputs, inputs.scenarios[0]!, '2026-02').phase).toBe('Retraite');
  });

  it('un mois absent du calcul retombe sur les phases et pensions saisies', () => {
    const inputs = inputsCalcules();
    const mars = monthlyIncome(inputs, inputs.scenarios[0]!, '2026-03');
    expect(mars.activite.a).toBe(999 + 888);
    expect(mars.pension.a).toBe(777 + 666);
    expect(mars.phase).toBe('Retraite');
  });

  it('sans revenusMensuels, le comportement du lot 1 est inchangé', () => {
    const inputs = inputsCalcules();
    const { revenusMensuels: _r, phasesMensuelles: _p, ...scenario } = inputs.scenarios[0]!;
    const janvier = monthlyIncome(inputs, scenario, '2026-01');
    expect(janvier.activite.a).toBe(999 + 888);
    expect(janvier.phase).toBe('Retraite'); // pension saisie active : règle du lot 1
  });

  it('la simulation utilise le cash calculé', () => {
    const inputs = inputsCalcules();
    const mois = simulateScenario(inputs, inputs.scenarios[0]!).mois;
    expect(mois[0]?.revenusParPersonne).toEqual({ a: 3000, b: 500 });
    expect(mois[0]?.revenus).toBe(3500);
    expect(mois[1]?.phase).toBe('Retraite');
  });
});

describe('rapport retraite avec détail calculé', () => {
  it('net après impôt : moyenne du cash des mois de retraite en € de l année de référence, détail exposé', () => {
    const inputs = inputsCalcules();
    inputs.macro.inflation = 0.02;
    inputs.horizon.anneeReferencePrix = 2025; // indice 1,02 sur tous les mois de 2026
    Object.assign(inputs.scenarios[0]!, {
      revenusMensuels: { a: { '2026-01': 3000, '2026-02': 1000, '2026-03': 2000 } },
      retraiteDetail: { a: DETAIL },
      debutsRetraite: { a: '2026-02' },
    });
    const rapport = buildProjectionReport(inputs, [], 's1', []);
    const a = rapport.retraite[0]!.parPersonne.find((p) => p.personneId === 'a')!;
    expect(a.netAvantImpot).toBe(1650);
    expect(a.netApresImpot).toBeCloseTo((1000 + 2000) / 2 / 1.02, 8);
    expect(a.detail).toBe(DETAIL);
    // la personne sans détail garde les pensions saisies (aucune ici) et n'expose pas de détail
    const b = rapport.retraite[0]!.parPersonne.find((p) => p.personneId === 'b')!;
    expect(b.detail).toBeUndefined();
    expect(b.netApresImpot).toBe(0);
    expect(rapport.retraite[0]!.totalApresImpot).toBeCloseTo(a.netApresImpot, 8);
    // le taux de remplacement compare la retraite après impôt au cash du 1er mois (3000 + 500)
    expect(rapport.retraite[0]!.tauxRemplacement).toBeCloseTo(a.netApresImpot / 3500, 8);
  });

  it('sans mois de retraite dans l horizon, retombe sur le net avant impôt', () => {
    const inputs = inputsCalcules();
    Object.assign(inputs.scenarios[0]!, {
      retraiteDetail: { a: DETAIL },
      debutsRetraite: {},
    });
    const a = buildProjectionReport(inputs, [], 's1', []).retraite[0]!.parPersonne[0]!;
    expect(a.netApresImpot).toBe(1650);
  });

  it('les pensions saisies du lot 1 sont inchangées sans détail', () => {
    const inputs = makeInputs({ pensionsCommunes: [makePension('a', 700, '2026-01', 800)] });
    const a = buildProjectionReport(inputs, [], 's1', []).retraite[0]!.parPersonne[0]!;
    expect([a.netAvantImpot, a.netApresImpot, a.detail]).toEqual([800, 700, undefined]);
  });
});
