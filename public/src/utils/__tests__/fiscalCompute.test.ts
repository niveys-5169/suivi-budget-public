import { describe, expect, it } from 'vitest';
import {
  coefficientAnnualisation,
  computeFiscalParAnnee,
  type FiscalInput,
} from '../projection/fiscal/computeFiscal';

const INPUT: FiscalInput = {
  annees: [{ annee: 2027, moisProjetes: 12, imposableP1: 30000, bncP1: 0, imposableP2: 40000 }],
  enfants: [],
  indexation: 0,
  ageLimiteRattachement: 21,
  tauxIndividualises: true,
  premiereAnneeRecalculee: 2027,
  tauxReelsActuels: { p1: 0.07, p2: 0.041 },
};

describe('coefficientAnnualisation', () => {
  it('annualise une année partielle', () => {
    expect(coefficientAnnualisation(4)).toBe(3);
    expect(coefficientAnnualisation(12)).toBe(1);
    expect(coefficientAnnualisation(0)).toBe(0);
  });
});

describe('computeFiscalParAnnee', () => {
  it('année pleine : abattements, IR du couple et taux individualisés', () => {
    // J = 70000 − 3000 − 4000 = 63000 ; IR = 5107,98 ; foyer 7,3 % ;
    // P1 (moins payé, 2 500 €/mois → 5,3 %) ; P2 = (5107,98 − 30000×5,3 %)/40000 = 8,8 %
    const [r] = computeFiscalParAnnee(INPUT);
    expect(r?.parts).toBe(2);
    expect(r?.revenuNetImposable).toBeCloseTo(63000, 6);
    expect(r?.irNet).toBeCloseTo(5107.98, 6);
    expect(r?.tauxFoyer).toBe(0.073);
    expect(r?.tauxP1).toBe(0.053);
    expect(r?.tauxP2).toBe(0.088);
  });

  it('année partielle : annualise les revenus des mois projetés', () => {
    const [r] = computeFiscalParAnnee({
      ...INPUT,
      annees: [{ annee: 2027, moisProjetes: 6, imposableP1: 15000, bncP1: 0, imposableP2: 20000 }],
    });
    expect(r?.revenuNetImposable).toBeCloseTo(63000, 6);
    expect(r?.irNet).toBeCloseTo(5107.98, 6);
  });

  it('BNC : ajouté au revenu sans abattement de 10 %', () => {
    const [r] = computeFiscalParAnnee({
      ...INPUT,
      annees: [
        { annee: 2027, moisProjetes: 12, imposableP1: 20000, bncP1: 10000, imposableP2: 40000 },
      ],
    });
    // 70000 − abattement(20000)=2000 − abattement(40000)=4000
    expect(r?.revenuNetImposable).toBeCloseTo(64000, 6);
  });

  it('avant la première année recalculée : taux réels saisis', () => {
    const [r] = computeFiscalParAnnee({
      ...INPUT,
      annees: [{ annee: 2026, moisProjetes: 12, imposableP1: 30000, bncP1: 0, imposableP2: 40000 }],
    });
    expect(r?.tauxP1).toBe(0.07);
    expect(r?.tauxP2).toBe(0.041);
    expect(r?.irNet).toBeCloseTo(5107.98, 6); // l'IR reste calculé
  });

  it('mode commun : même taux pour les deux personnes', () => {
    const [r] = computeFiscalParAnnee({ ...INPUT, tauxIndividualises: false });
    expect(r?.tauxP1).toBe(0.073);
    expect(r?.tauxP2).toBe(0.073);
  });

  it('indexe le barème : l’impôt baisse quand l’indice monte', () => {
    const [sans] = computeFiscalParAnnee(INPUT);
    const [avec] = computeFiscalParAnnee({
      ...INPUT,
      indexation: 0.02,
      anneeReferenceBareme: 2025,
    });
    expect(avec!.irNet).toBeLessThan(sans!.irNet);
  });

  it('parts selon l’âge des enfants au 1er janvier de chaque année', () => {
    const res = computeFiscalParAnnee({
      ...INPUT,
      enfants: [{ dateNaissance: '2010-06-15' }],
      annees: [2031, 2032].map((annee) => ({
        annee,
        moisProjetes: 12,
        imposableP1: 30000,
        bncP1: 0,
        imposableP2: 40000,
      })),
    });
    expect(res.map((r) => r.parts)).toEqual([2.5, 2]);
  });

  it('année sans mois projeté : tout à zéro, sans NaN', () => {
    const [r] = computeFiscalParAnnee({
      ...INPUT,
      annees: [{ annee: 2027, moisProjetes: 0, imposableP1: 0, bncP1: 0, imposableP2: 0 }],
    });
    expect(r).toMatchObject({ revenuNetImposable: 0, irNet: 0, tauxP1: 0, tauxP2: 0 });
  });
});
