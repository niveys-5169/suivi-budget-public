import { describe, expect, it } from 'vitest';
import { computeRetraitePersonne, netDepuisBrut } from '../projection/retraite/computeRetraite';
import type {
  ProjectionRetraiteCarriereAnnee,
  ProjectionRetraitePersonneParams,
} from '../../types/banking.types';

const PARAMS: ProjectionRetraitePersonneParams = {
  personneId: 'p1',
  trimestresValides: 100,
  anneeReleve: 2025,
  trimestresRequis: 172,
  pointsAgircArrco: 1000,
  valeurPointAgircArrco: 1.4,
  prixPointAgircArrco: 20,
  pointsCipavParAn: 380,
  bncReferenceCipav: 35000,
  valeurPointCipav: 0.5,
  rentePerMensuelle: 100,
  tauxPrelevementsSociaux: 0.1,
  revalorisationSalaires: 0,
  croissancePass: 0.02,
  nombreMeilleuresAnnees: 25,
};

const salaires = (
  debut: number,
  fin: number,
  salaireRG: number,
): ProjectionRetraiteCarriereAnnee[] =>
  Array.from({ length: fin - debut + 1 }, (_, i) => ({ annee: debut + i, salaireRG }));

describe('netDepuisBrut', () => {
  it('retire les prélèvements sociaux', () => {
    expect(netDepuisBrut(2000, 0.091)).toBeCloseTo(1818, 8);
  });
});

describe('computeRetraitePersonne', () => {
  it('carrière salariée incomplète : décote plafonnée, proratisation, points ajoutés', () => {
    const r = computeRetraitePersonne({ params: PARAMS, carriere: salaires(2026, 2030, 40000) });
    expect(r.trimestres).toEqual({
      regimeGeneral: 120,
      autresRegimes: 0,
      total: 120,
      manquants: 20,
    });
    expect(r.sam).toBe(40000);
    expect(r.anneesRetenues).toBe(5);
    expect(r.tauxLiquidation).toBeCloseTo(0.375, 10);
    expect(r.detailBrut.cnav).toBeCloseTo((40000 * 0.375 * (120 / 172)) / 12, 8);
    expect(r.pointsAgircArrco).toBeCloseTo(1000 + 5 * 124, 8);
    expect(r.detailBrut.agircArrco).toBeCloseTo((1620 * 1.4 * 0.8) / 12, 8);
    expect(r.detailBrut.cipav).toBe(0);
    expect(r.detailBrut.per).toBe(100);
    expect(r.totalBrut).toBeCloseTo(r.detailBrut.cnav + r.detailBrut.agircArrco + 100, 8);
    expect(r.netAvantImpot).toBeCloseTo(r.totalBrut * 0.9, 8);
  });

  it('années BNC : trimestres Cipav au taux, années SAM réduites, points Cipav', () => {
    const carriere = [
      ...salaires(2026, 2030, 40000),
      { annee: 2031, bnc: 35000 },
      { annee: 2032, bnc: 70000 },
    ];
    const r = computeRetraitePersonne({ params: PARAMS, carriere });
    expect(r.trimestres.autresRegimes).toBe(8);
    expect(r.trimestres.total).toBe(128);
    expect(r.anneesRetenues).toBe(5);
    expect(r.pointsCipav).toBe(380 + 760);
    expect(r.detailBrut.cipav).toBeCloseTo((1140 * 0.5) / 12, 8);
  });

  it('trimestresAutresRegimes impose le nombre de trimestres hors régime général', () => {
    const carriere = [...salaires(2026, 2030, 40000), { annee: 2031, bnc: 35000 }];
    const r = computeRetraitePersonne({ params: PARAMS, carriere, trimestresAutresRegimes: 40 });
    expect(r.trimestres.autresRegimes).toBe(40);
    expect(r.trimestres.manquants).toBe(12);
  });

  it('les salaires passés connus priment ; les années du relevé ne valident pas de trimestre', () => {
    const params = { ...PARAMS, salairesPasses: { '2024': 30000, '2026': 50000 } };
    const r = computeRetraitePersonne({ params, carriere: salaires(2026, 2026, 20000) });
    expect(r.trimestres.regimeGeneral).toBe(104);
    expect(r.anneesRetenues).toBe(2);
    expect(r.sam).toBeCloseTo((30000 * 1.031 + 48060) / 2, 6);
  });

  it('points Agirc-Arrco fournis en amont remplacent ceux de l’assiette ; taux plein à 67 ans', () => {
    const carriere = [{ annee: 2026, salaireRG: 40000, pointsAgircArrco: 50 }];
    const r = computeRetraitePersonne({ params: PARAMS, carriere, ageLiquidation: 67 });
    expect(r.pointsAgircArrco).toBe(1050);
    expect(r.tauxLiquidation).toBe(0.5);
    expect(r.detailBrut.agircArrco).toBeCloseTo((1050 * 1.4) / 12, 8);
  });
});
