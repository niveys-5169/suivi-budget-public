import { describe, expect, it } from 'vitest';
import type { ProjectionValeursObservees } from '../../types/banking.types';
import { computeActivitePersonne1 } from '../projection/activite/computeActivite';
import {
  blocsManquants,
  computeScenarioCalcule,
} from '../projection/calculateurs/computeScenarioCalcule';
import { resolveProjectionParams } from '../projection/resolveParams';
import { makeCalculateursParams } from './calculateursFixtures';

const SANS_OBSERVE: ProjectionValeursObservees = {
  periode: null,
  budgetReference: null,
  detailCategories: [],
  moyenneMensuelleParCategorie: {},
  credits: {},
  patrimoineHorsPer: null,
  epargneNetteMensuelle: null,
};

const indice = (annee: number) => 1.02 ** (annee - 2029);

describe('blocsManquants', () => {
  it('vide quand les trois blocs et la retraite de la personne 1 sont présents', () => {
    expect(blocsManquants(makeCalculateursParams())).toEqual([]);
  });

  it('liste les blocs absents', () => {
    const params = makeCalculateursParams();
    delete params.calculateurs!.fiscal;
    delete params.calculateurs!.activite;
    expect(blocsManquants(params)).toEqual(['fiscal', 'activité']);
    params.calculateurs!.retraite!.personnes = [];
    expect(blocsManquants(params)).toContain('retraite de la personne 1');
    delete params.calculateurs;
    expect(blocsManquants(params)).toEqual(['fiscal', 'activité', 'retraite']);
  });
});

describe('computeScenarioCalcule', () => {
  const params = makeCalculateursParams();
  const { horizon } = params;
  const activite = (id: string) =>
    computeActivitePersonne1({ horizon, params: params.calculateurs!.activite! }, id);
  // Libéral rentable : le revenu de P1 dépasse celui de P2, son taux PAS n'est plus nul.
  const makeRentable = () => {
    const p = makeCalculateursParams();
    p.calculateurs!.activite!.liberal.tarifMesure = 400;
    p.calculateurs!.activite!.irImpute = { revenuImposableAutrePersonne: 30000, parts: 2 };
    return p;
  };
  const rentable = makeRentable();
  const activiteRentable = (id: string) =>
    computeActivitePersonne1({ horizon, params: rentable.calculateurs!.activite! }, id);
  const tauxDe = (calcul: NonNullable<ReturnType<typeof computeScenarioCalcule>>, annee: number) =>
    calcul.fiscal.find((f) => f.annee === annee)!;

  it('renvoie undefined sans blocs complets', () => {
    const incomplet = makeCalculateursParams();
    delete incomplet.calculateurs!.retraite;
    expect(computeScenarioCalcule(incomplet, 's1')).toBeUndefined();
  });

  it('cash du salarié : net avant PAS − taux de l année × net imposable, un mois par mois d horizon', () => {
    const calcul = computeScenarioCalcule(params, 's1')!;
    const mois = activite('s1').find((m) => m.mois === '2033-05')!;
    const taux = tauxDe(calcul, 2033);
    expect(taux.tauxP1).toBeGreaterThan(0);
    expect(Object.keys(calcul.revenusMensuels.p1!)).toHaveLength(171); // 2029-10 → 2043-12
    expect(calcul.revenusMensuels.p1!['2033-05']).toBeCloseTo(
      mois.netAvantPas - taux.tauxP1 * mois.netImposable,
      8,
    );
    expect(calcul.phasesMensuelles['2033-05']).toBe(mois.phase);
    expect(calcul.phasesMensuelles['2029-10']).toBe('Situation actuelle');
  });

  it('cash de la personne 2 : salaire revalorisé puis pension, taux propre à P2', () => {
    const calcul = computeScenarioCalcule(params, 's1')!;
    const taux = tauxDe(calcul, 2035);
    expect(taux.tauxP2).toBeGreaterThan(0);
    const mois = activite('s1').find((m) => m.mois === '2035-02')!;
    expect(calcul.revenusMensuels.p2!['2035-02']).toBeCloseTo(
      mois.netAvantPasPersonne2 - taux.tauxP2 * mois.netImposablePersonne2,
      8,
    );
    expect(mois.netAvantPasPersonne2).toBeGreaterThan(0);
  });

  it('pensions : à partir du mois suivant le départ de P1 et dès la fin d activité de P2', () => {
    const forte = makeCalculateursParams(); // rente PER élevée : P1 a un revenu supérieur à celui de P2
    forte.calculateurs!.retraite!.personnes[0]!.rentePerMensuelle = 2500;
    const calcul = computeScenarioCalcule(forte, 's1')!;
    expect(calcul.debutsRetraite).toEqual({ p1: '2042-07', p2: '2043-03' });
    expect(calcul.phasesMensuelles['2042-06']).not.toBe('Retraite');
    expect(calcul.phasesMensuelles['2042-07']).toBe('Retraite');
    const [r1, r2] = [calcul.retraiteDetail.p1!, calcul.retraiteDetail.p2!];
    const csg = 0.05;
    // P1, 2042-07 : pension nette indexée − taux × (brut × (1 − CSG déductible)) indexé.
    const taux1 = tauxDe(calcul, 2042).tauxP1;
    expect(taux1).toBeGreaterThan(0);
    expect(calcul.revenusMensuels.p1!['2042-07']).toBeCloseTo(
      (r1.netAvantImpot - taux1 * r1.totalBrut * (1 - csg)) * indice(2042),
      6,
    );
    // P2, 2043-03 : plus de salaire, la pension seule.
    const taux2 = tauxDe(calcul, 2043).tauxP2;
    expect(calcul.revenusMensuels.p2!['2043-02']).toBeGreaterThan(0);
    expect(calcul.revenusMensuels.p2!['2043-03']).toBeCloseTo(
      (r2.netAvantImpot - taux2 * r2.totalBrut * (1 - csg)) * indice(2043),
      6,
    );
  });

  it('détail de retraite : régimes, trimestres et cohérence brut/net', () => {
    const { retraiteDetail } = computeScenarioCalcule(params, 's2')!;
    const r1 = retraiteDetail.p1!;
    expect(r1.detailBrut.cipav).toBeGreaterThan(0); // libéral : points Cipav
    expect(r1.detailBrut.per).toBe(100);
    expect(r1.totalBrut).toBeCloseTo(
      r1.detailBrut.cnav + r1.detailBrut.agircArrco + r1.detailBrut.cipav + r1.detailBrut.per,
      8,
    );
    expect(r1.netAvantImpot).toBeCloseTo(r1.totalBrut * (1 - 0.09), 8);
    expect(r1.trimestres.autresRegimes).toBe(4 * (2042 - 2036));
    expect(computeScenarioCalcule(params, 's1')!.retraiteDetail.p1!.detailBrut.cipav).toBe(0);
  });

  it('libéral : le versement PER TNS sort du cash et l IR suit le taux recalculé', () => {
    const calcul = computeScenarioCalcule(rentable, 's2')!;
    const mois = activiteRentable('s2').find((m) => m.mois === '2038-05')!;
    const taux = tauxDe(calcul, 2038).tauxP1;
    expect(taux).toBeGreaterThan(0);
    expect(mois.per).toBeGreaterThan(0);
    const attendu = mois.netAvantPas - taux * (mois.netImposableHorsLiberal + mois.bncImposable);
    expect(calcul.revenusMensuels.p1!['2038-05']).toBeCloseTo(attendu - mois.per, 8);

    const sansSortie = makeRentable();
    sansSortie.calculateurs!.activite!.liberal.perSortieDeCash = false;
    expect(computeScenarioCalcule(sansSortie, 's2')!.revenusMensuels.p1!['2038-05']).toBeCloseTo(
      attendu,
      8,
    );
  });

  it('IR du libéral imputé de ② quand le taux recalculé est désactivé', () => {
    const impute = makeRentable();
    impute.calculateurs!.fiscal!.irLiberalParTaux = false;
    const calcul = computeScenarioCalcule(impute, 's2')!;
    const mois = activiteRentable('s2').find((m) => m.mois === '2038-05')!;
    const taux = tauxDe(calcul, 2038).tauxP1;
    expect(taux).toBeGreaterThan(0);
    expect(mois.liberalIrImpute).toBeGreaterThan(0);
    expect(calcul.revenusMensuels.p1!['2038-05']).toBeCloseTo(
      mois.netAvantPas - taux * mois.netImposableHorsLiberal - mois.liberalIrImpute - mois.per,
      8,
    );
  });

  it('sans salaire de référence pour la personne 2 : pas de pension P2, salaire seul', () => {
    const sans = makeCalculateursParams();
    delete sans.calculateurs!.activite!.personne2!.salaireBrutAnnuel;
    const calcul = computeScenarioCalcule(sans, 's1')!;
    expect(calcul.retraiteDetail.p2).toBeUndefined();
    expect(calcul.debutsRetraite.p2).toBeUndefined();
    expect(calcul.revenusMensuels.p2!['2043-06']).toBeCloseTo(0, 8);
  });

  it('un seul adulte : pas de revenus pour la personne 2', () => {
    const seul = makeCalculateursParams();
    seul.personnes = [seul.personnes[0]!];
    delete seul.calculateurs!.activite!.personne2;
    const calcul = computeScenarioCalcule(seul, 's1')!;
    expect(Object.keys(calcul.revenusMensuels)).toEqual(['p1']);
  });
});

describe('resolveProjectionParams avec calculateurs', () => {
  it('renseigne les scénarios résolus quand les calculateurs sont actifs', () => {
    const inputs = resolveProjectionParams(makeCalculateursParams(), SANS_OBSERVE);
    expect(inputs.messagesCalculateurs).toBeUndefined();
    for (const s of inputs.scenarios) {
      expect(Object.keys(s.revenusMensuels ?? {})).toEqual(['p1', 'p2']);
      expect(s.retraiteDetail?.p1?.totalBrut).toBeGreaterThan(0);
      expect(s.phasesMensuelles?.['2029-10']).toBe('Situation actuelle');
    }
  });

  it('ne calcule rien quand les calculateurs sont inactifs ou absents', () => {
    const inactif = makeCalculateursParams();
    inactif.calculateurs!.actif = false;
    expect(
      resolveProjectionParams(inactif, SANS_OBSERVE).scenarios[0]?.revenusMensuels,
    ).toBeUndefined();
    delete inactif.calculateurs;
    expect(
      resolveProjectionParams(inactif, SANS_OBSERVE).scenarios[0]?.revenusMensuels,
    ).toBeUndefined();
  });

  it('un bloc manquant : pas de calcul, un message, sans planter', () => {
    const params = makeCalculateursParams();
    delete params.calculateurs!.retraite;
    const inputs = resolveProjectionParams(params, SANS_OBSERVE);
    expect(inputs.scenarios.every((s) => s.revenusMensuels === undefined)).toBe(true);
    expect(inputs.messagesCalculateurs?.[0]).toContain('retraite');
  });

  it('signale un scénario sans mesures cibles et le calcule en association', () => {
    const params = makeCalculateursParams();
    params.scenarios.push({ id: 's3', nom: 'Nouveau', phases: [], pensions: [] });
    const inputs = resolveProjectionParams(params, SANS_OBSERVE);
    expect(inputs.messagesCalculateurs?.join()).toContain('Nouveau');
    expect(inputs.scenarios[2]?.revenusMensuels?.p1).toBeDefined();
  });
});
