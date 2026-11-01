import { describe, expect, it } from 'vitest';
import {
  arrondiTableur,
  chargesAnnuelles,
  computeLiberalAnnees,
  cotisationsLiberal,
  irFoyerImpute,
} from '../projection/activite/liberal';
import { activiteParams } from './activiteFixtures';

const { liberal } = activiteParams;

describe('libéral (②)', () => {
  it('proratise les charges variables, applique le coefficient CFE et garde les fixes', () => {
    // fixe 1 000 + variable 2 000 × 5 / 10 + cfe 400 × 0,5
    expect(chargesAnnuelles(liberal.charges, 5, 10, 0.5)).toBeCloseTo(1000 + 1000 + 200, 10);
  });

  it('arrondit les mesures de la montée en charge comme un tableur (demi vers le haut)', () => {
    expect(arrondiTableur(31.5)).toBe(32);
    expect(arrondiTableur(45 * 0.7)).toBe(32);
    expect(arrondiTableur(30 * 0.7)).toBe(21);
  });

  it('monte en charge sur 3 ans : mesures, CA, charges et BNC', () => {
    const [an1, an2, an3] = computeLiberalAnnees(liberal, 20);
    expect([an1!.mesures, an2!.mesures, an3!.mesures]).toEqual([10, 15, 20]);
    expect([an1!.caAnnuel, an2!.caAnnuel, an3!.caAnnuel]).toEqual([12000, 18000, 24000]);
    expect([an1!.charges, an2!.charges, an3!.charges]).toEqual([3000, 4200, 5400]);
    expect([an1!.bnc, an2!.bnc, an3!.bnc]).toEqual([9000, 13800, 18600]);
  });

  it('calcule les cotisations sur 74 % du BNC (sous le PASS : taux cumulés de 46,4 % en année 1)', () => {
    // 0,004 + 0,0335 + 0,1775 + 0,006 + 0,11 + 0,005 + 0,031 + 0,097
    expect(cotisationsLiberal(9000, 0.0335)).toBeCloseTo(9000 * 0.74 * 0.464, 8);
  });

  it('applique le taux de 21 % de la retraite complémentaire au-delà du PASS', () => {
    const assiette = 80000 * 0.74;
    const attendu =
      assiette * (0.004 + 0.065 + 0.006 + 0.005 + 0.031 + 0.097) +
      48060 * (0.1775 + 0.11) +
      (assiette - 48060) * 0.21;
    expect(cotisationsLiberal(80000, 0.065)).toBeCloseTo(attendu, 8);
  });

  it('déduit cotisations et PER du BNC imposable', () => {
    const [an1] = computeLiberalAnnees(liberal, 20);
    expect(an1!.cotisations).toBeCloseTo(3090.24, 8);
    expect(an1!.bncImposable).toBeCloseTo(9000 - 3090.24 - 1200, 8);
  });

  it('accepte des taux de maladie-maternité saisis', () => {
    const [an1] = computeLiberalAnnees({ ...liberal, tauxMaladieMaternite: [0, 0, 0] }, 20);
    expect(an1!.cotisations).toBeCloseTo(6660 * 0.4305, 8);
  });

  it("impute à la personne 1 la part de l'IR du foyer proportionnelle à son BNC imposable", () => {
    const [an1] = computeLiberalAnnees(liberal, 20, {
      revenuImposableAutrePersonne: 30000,
      parts: 2,
    });
    const bncImposable = an1!.bncImposable;
    const rni = bncImposable + 30000;
    const ir = 2 * ((rni / 2 - 11497) * 0.11); // quotient < 29 315
    expect(an1!.irImpute).toBeCloseTo((ir * bncImposable) / rni, 8);
  });

  it("calcule l'IR par tranches du barème", () => {
    expect(irFoyerImpute(2 * 11497, 2)).toBe(0);
    const q = 40000;
    const attendu = (29315 - 11497) * 0.11 + (q - 29315) * 0.3;
    expect(irFoyerImpute(q * 2, 2)).toBeCloseTo(2 * attendu, 8);
  });

  it('un scénario sans mesures donne un BNC négatif (charges fixes seules) sans impôt imputé', () => {
    const [an1] = computeLiberalAnnees(liberal, 0);
    expect(an1!.mesures).toBe(0);
    expect(an1!.bnc).toBe(-1000);
    expect(an1!.irImpute).toBe(0);
  });
});
