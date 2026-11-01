import { describe, it, expect } from 'vitest';
import { simulateAll } from '../projection/simulateProjection';
import { buildProjectionReport } from '../projection/projectionReport';
import type { ProjectionInputs, ProjectionScenarioResultat } from '../../types/banking.types';
import { makeInputs, makePension, makePhase } from './projectionFixtures';

function report(
  inputs: ProjectionInputs,
  afficheId = 's1',
  aConfirmer: { id: string; libelle: string }[] = [],
) {
  return buildProjectionReport(inputs, simulateAll(inputs), afficheId, aConfirmer);
}

describe('buildProjectionReport : retraite', () => {
  const inputs = makeInputs({
    caf: { montant: 400, evolutionAnnuelle: 0 },
    phasesCommunes: [makePhase('b', 1000, '2026-01')],
    pensionsCommunes: [makePension('a', 150, '2030-01', 200)],
    scenarios: [
      {
        id: 's1',
        nom: 'S1',
        phases: [makePhase('a', 2000, '2026-01')],
        pensions: [makePension('a', 1500, '2030-01', 1800), makePension('b', 500, '2030-01', 600)],
      },
      { id: 's2', nom: 'S2', phases: [makePhase('a', 2000, '2026-01')], pensions: [] },
    ],
  });

  it('somme les pensions communes et du scénario par personne et pour le foyer', () => {
    const [s1, s2] = report(inputs).retraite;
    expect(s1?.parPersonne).toEqual([
      { personneId: 'a', prenom: 'Alice', netAvantImpot: 2000, netApresImpot: 1650 },
      { personneId: 'b', prenom: 'Bruno', netAvantImpot: 600, netApresImpot: 500 },
    ]);
    expect(s1?.totalAvantImpot).toBe(2600);
    expect(s1?.totalApresImpot).toBe(2150);
    expect(s2?.parPersonne[0]).toMatchObject({ netAvantImpot: 200, netApresImpot: 150 });
    expect(s2?.parPersonne[1]).toMatchObject({ netAvantImpot: 0, netApresImpot: 0 });
  });

  it('taux de remplacement = foyer après impôt / revenus d activité au 1er mois, hors CAF', () => {
    const [s1] = report(inputs).retraite;
    expect(s1?.tauxRemplacement).toBeCloseTo(2150 / 3000, 10);
  });

  it('taux de remplacement nul (null) sans revenu d activité', () => {
    const sansActivite = makeInputs({
      caf: { montant: 400, evolutionAnnuelle: 0 },
      scenarios: [
        { id: 's1', nom: 'S1', phases: [], pensions: [makePension('a', 900, '2030-01')] },
      ],
    });
    expect(report(sansActivite).retraite[0]?.tauxRemplacement).toBeNull();
  });
});

describe('buildProjectionReport : synthèse', () => {
  const inputs = makeInputs({
    horizon: { debut: '2026-01', fin: '2026-06', anneeReferencePrix: 2026 },
    capitalInitial: 300,
    patrimoineDepart: 1000,
    budgetReference: 1200,
    exceptionnelles: [{ id: 'e1', libelle: 'Travaux', montant: 50, mois: '2026-01' }],
    scenarios: [{ id: 's1', nom: 'S1', phases: [makePhase('a', 1000, '2026-01')], pensions: [] }],
  });

  it('indicateurs de fin d horizon, épuisement du capital et prélèvements', () => {
    // capacité −200/mois ; janvier : 300 − 200 − 50 = 50 ; février : −150 → capital 0, prélèvement 150 ; puis 200/mois
    const s = report(inputs).synthese[0];
    expect(s).toMatchObject({
      scenarioId: 's1',
      nom: 'S1',
      patrimoineFinal: 50,
      patrimoineFinalReel: 50,
      capitalFinal: 0,
      horsPerFinal: 50,
      moisEpuisementCapital: '2026-02',
      prelevementCumule: 950,
      moisDeficit: 6,
      revenus: 1000,
      depenses: 1200,
      capacite: -200,
      epargneCumulee: -1250,
    });
    expect(s?.revenusParPersonne).toEqual({ a: 1000, b: 0 });
  });

  it('patrimoine final réel : déflaté de (1+inflation)^(année de fin − année de référence)', () => {
    const avecInflation = makeInputs({
      horizon: { debut: '2026-01', fin: '2028-12', anneeReferencePrix: 2026 },
      macro: { inflation: 0.02, rendementCapital: 0, rendementPatrimoine: 0 },
      capitalInitial: 1000,
    });
    const s = report(avecInflation).synthese[0];
    expect(s?.patrimoineFinal).toBeCloseTo(1000, 6);
    expect(s?.patrimoineFinalReel).toBeCloseTo(1000 / 1.0404, 6);
  });

  it('moisEpuisementCapital est null si le capital ne s épuise jamais ou n a jamais été positif', () => {
    const jamaisEpuise = makeInputs({ capitalInitial: 500 });
    expect(report(jamaisEpuise).synthese[0]?.moisEpuisementCapital).toBeNull();
    const toujoursNul = makeInputs({ budgetReference: 100 });
    expect(report(toujoursNul).synthese[0]?.moisEpuisementCapital).toBeNull();
  });

  it('épuisement dès le 1er mois si le capital initial est consommé immédiatement', () => {
    const immediat = makeInputs({ capitalInitial: 100, budgetReference: 500 });
    expect(report(immediat).synthese[0]?.moisEpuisementCapital).toBe('2026-01');
  });
});

describe('buildProjectionReport : évolution au 31/12', () => {
  it('patrimoine total en décembre, ou au dernier mois de l horizon pour la dernière année', () => {
    const inputs = makeInputs({
      horizon: { debut: '2026-11', fin: '2028-02', anneeReferencePrix: 2026 },
      scenarios: [
        { id: 's1', nom: 'S1', phases: [makePhase('a', 100, '2026-11')], pensions: [] },
        { id: 's2', nom: 'S2', phases: [makePhase('a', 200, '2026-11')], pensions: [] },
      ],
    });
    expect(report(inputs).evolution).toEqual([
      { annee: 2026, parScenario: { s1: 200, s2: 400 } },
      { annee: 2027, parScenario: { s1: 1400, s2: 2800 } },
      { annee: 2028, parScenario: { s1: 1600, s2: 3200 } },
    ]);
  });
});

describe('buildProjectionReport : phases du scénario affiché', () => {
  const inputs = makeInputs({
    horizon: { debut: '2026-01', fin: '2026-07', anneeReferencePrix: 2026 },
    caf: { montant: 100, evolutionAnnuelle: 0, dernierMois: '2026-06' },
    phasesCommunes: [makePhase('b', 500, '2026-01')],
    budgetReference: 1000,
    scenarios: [
      {
        id: 's1',
        nom: 'S1',
        phases: [
          makePhase('a', 2000, '2026-01', { fin: '2026-03', libelle: 'Actif' }),
          makePhase('a', 1000, '2026-04', { fin: '2026-06', libelle: 'Transition' }),
        ],
        pensions: [],
      },
      { id: 's2', nom: 'S2', phases: [], pensions: [] },
    ],
  });

  it('moyennes mensuelles par phase, dans l ordre d apparition', () => {
    expect(report(inputs, 's1').phases).toEqual([
      {
        phase: 'Actif',
        nbMois: 3,
        revenusParPersonne: { a: 2000, b: 500 },
        caf: 100,
        revenus: 2600,
        depenses: 1000,
        capacite: 1600,
      },
      {
        phase: 'Transition',
        nbMois: 3,
        revenusParPersonne: { a: 1000, b: 500 },
        caf: 100,
        revenus: 1600,
        depenses: 1000,
        capacite: 600,
      },
      {
        phase: '—',
        nbMois: 1,
        revenusParPersonne: { a: 0, b: 500 },
        caf: 0,
        revenus: 500,
        depenses: 1000,
        capacite: -500,
      },
    ]);
  });

  it('ignore la phase de la personne 2 dans le découpage par phase', () => {
    const avecP2 = makeInputs({
      budgetReference: 1000,
      scenarios: [
        {
          id: 's1',
          nom: 'S1',
          phases: [
            makePhase('a', 2000, '2026-01', { libelle: 'Actif' }),
            makePhase('b', 700, '2026-01', { libelle: 'Activité P2' }),
          ],
          pensions: [makePension('b', 300, '2026-03')],
        },
      ],
    });
    const phases = report(avecP2, 's1').phases;
    expect(phases.map((p) => [p.phase, p.nbMois])).toEqual([['Actif', 3]]);
    expect(phases[0]?.revenusParPersonne).toEqual({ a: 2000, b: 800 });
  });

  it('suit le scénario affiché', () => {
    const rapport = report(inputs, 's2');
    expect(rapport.scenarioAfficheId).toBe('s2');
    expect(rapport.phases.map((p) => p.phase)).toEqual(['—']);
  });
});

describe('buildProjectionReport : année par année', () => {
  const inputs = makeInputs({
    horizon: { debut: '2026-11', fin: '2027-03', anneeReferencePrix: 2026 },
    capitalInitial: 1000,
    patrimoineDepart: 500,
    budgetReference: 1500,
    credits: [
      {
        id: 'c1',
        libelle: 'Crédit',
        mensualite: 100,
        fin: '2027-03',
        tauxAnnuel: 0,
        remboursementAnticipe: { mois: '2027-01', frais: 20 },
      },
    ],
    exceptionnelles: [{ id: 'e1', libelle: 'Voyage', montant: 300, mois: '2027-02' }],
    encaissements: [{ id: 'i1', libelle: 'Indemnité', montant: 800, mois: '2026-12' }],
    abondement: { montantAnnuel: 50, mois: 2 },
    scenarios: [
      {
        id: 's1',
        nom: 'S1',
        phases: [makePhase('a', 2000, '2026-11', { fin: '2026-12', libelle: 'Actif' })],
        pensions: [makePension('a', 1200, '2027-01')],
      },
    ],
  });

  it('agrège les flux par année civile et calcule la variation de patrimoine', () => {
    // capital : 1500, 2800, 2280, 1780, 1580 ; hors PER : 500 puis 550 dès février 2027
    expect(report(inputs).annees).toEqual([
      {
        annee: 2026,
        phaseDecembre: 'Actif',
        revenus: 4000,
        depenses: 3000,
        capacite: 1000,
        depensesExceptionnelles: 0,
        encaissements: 800,
        remboursementsAnticipes: 0,
        rendements: 0,
        abondement: 0,
        variationPatrimoine: 1800,
        patrimoineFin: 3300,
      },
      {
        annee: 2027,
        phaseDecembre: 'Retraite',
        revenus: 3600,
        depenses: 4300,
        capacite: -700,
        depensesExceptionnelles: 300,
        encaissements: 0,
        remboursementsAnticipes: 220,
        rendements: 0,
        abondement: 50,
        variationPatrimoine: -1170,
        patrimoineFin: 2130,
      },
    ]);
  });
});

describe('buildProjectionReport : contrôles et points à confirmer', () => {
  const inputs = makeInputs({
    horizon: { debut: '2026-01', fin: '2028-12', anneeReferencePrix: 2026 },
    macro: { inflation: 0.02, rendementCapital: 0.04, rendementPatrimoine: 0.03 },
    capitalInitial: 2000,
    patrimoineDepart: 3000,
    budgetReference: 1500,
    credits: [
      {
        id: 'c1',
        libelle: 'Crédit',
        mensualite: 400,
        fin: '2028-06',
        tauxAnnuel: 3.5,
        remboursementAnticipe: { mois: '2027-05', frais: 100 },
      },
    ],
    encaissements: [{ id: 'i1', libelle: 'Indemnité', montant: 5000, mois: '2027-09' }],
    exceptionnelles: [{ id: 'e1', libelle: 'Voyage', montant: 1200, mois: '2026-07' }],
    abondement: { montantAnnuel: 600, mois: 6, finMois: '2027-06' },
    scenarios: [
      {
        id: 's1',
        nom: 'S1',
        phases: [makePhase('a', 1300, '2026-01', { revalorisationAnnuelle: 0.01 })],
        pensions: [],
      },
      {
        id: 's2',
        nom: 'S2',
        phases: [makePhase('a', 2500, '2026-01')],
        pensions: [makePension('b', 900, '2028-01')],
      },
    ],
  });

  it('variation annuelle = somme des flux et capital jamais négatif : vrais pour tous les scénarios', () => {
    const rapport = report(inputs);
    expect(rapport.controles.map((c) => c.id)).toEqual(
      expect.arrayContaining(['variation-egale-flux', 'capital-non-negatif']),
    );
    expect(
      rapport.controles.find((c) => c.libelle === 'Variation annuelle = somme des flux')?.ok,
    ).toBe(true);
    expect(rapport.controles.find((c) => c.libelle === 'Capital jamais négatif')?.ok).toBe(true);
    expect(rapport.synthese[0]?.prelevementCumule).toBeGreaterThan(0);
  });

  it('détecte un résultat incohérent', () => {
    const resultats: ProjectionScenarioResultat[] = simulateAll(inputs).map((r) => ({
      ...r,
      mois: r.mois.map((m) => ({ ...m })),
    }));
    const corrompu = resultats[0]?.mois[11];
    if (!corrompu) throw new Error('mois manquant');
    corrompu.patrimoineTotal += 10;
    corrompu.capital = -1;
    const rapport = buildProjectionReport(inputs, resultats, 's1', []);
    expect(rapport.controles.find((c) => c.id === 'variation-egale-flux')?.ok).toBe(false);
    expect(rapport.controles.find((c) => c.id === 'capital-non-negatif')?.ok).toBe(false);
  });

  it('recopie les points à confirmer', () => {
    const points = [{ id: 'p1', libelle: 'Taux de rendement', commentaire: 'À valider' }];
    expect(report(inputs, 's1', points).pointsAConfirmer).toEqual(points);
  });
});
