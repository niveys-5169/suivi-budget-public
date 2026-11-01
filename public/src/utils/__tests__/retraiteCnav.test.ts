import { describe, expect, it } from 'vitest';
import {
  coefficientProratisation,
  coefficientRevalorisation,
  nombreAnneesRetenues,
  passAnnee,
  pensionCnav,
  sam,
  salairePorteAuCompte,
  tauxLiquidation,
  trimestresManquants,
  trimestresDeLAnnee,
} from '../projection/retraite/cnav';

describe('PASS et revalorisation', () => {
  it('lit la table légale, puis projette au-delà de 2026', () => {
    expect(passAnnee(2020, 0.02)).toBe(41136);
    expect(passAnnee(2026, 0.02)).toBe(48060);
    expect(passAnnee(2030, 0.02)).toBeCloseTo(48060 * 1.02 ** 4, 6);
  });

  it('revalorise en € 2026 : table jusqu’en 2026, puis 1/(1+r)^n', () => {
    expect(coefficientRevalorisation(2010, 0.015)).toBe(1.267);
    expect(coefficientRevalorisation(2026, 0.015)).toBe(1);
    expect(coefficientRevalorisation(2030, 0.015)).toBeCloseTo(1 / 1.015 ** 4, 10);
  });
});

describe('salaire porté au compte', () => {
  it('plafonne au PASS de l’année puis revalorise', () => {
    expect(salairePorteAuCompte(60000, 2026, 0.02, 0.015)).toBe(48060);
    expect(salairePorteAuCompte(30000, 2025, 0.02, 0.015)).toBeCloseTo(30000 * 1.009, 6);
  });

  it('valide 1 trimestre par tranche de 1 803 €, 4 au maximum', () => {
    expect(trimestresDeLAnnee(1802)).toBe(0);
    expect(trimestresDeLAnnee(3606)).toBe(2);
    expect(trimestresDeLAnnee(50000)).toBe(4);
  });
});

describe('SAM et nombre d’années retenues', () => {
  it('moyenne des N meilleures années', () => {
    expect(sam([10, 40, 20, 30], 2)).toBe(35);
    expect(sam([10, 20], 5)).toBe(15);
  });

  it('réduit les 25 années au prorata des trimestres du régime général', () => {
    expect(nombreAnneesRetenues(43, 109, 173, 25)).toBe(16);
    expect(nombreAnneesRetenues(43, 120, 120, 25)).toBe(25);
    expect(nombreAnneesRetenues(10, 120, 120, 25)).toBe(10);
  });
});

describe('taux, proratisation, pension', () => {
  it('taux plein sans manquant, décote de 1,25 % de la pension par trimestre', () => {
    expect(trimestresManquants(172, 173)).toBe(0);
    expect(tauxLiquidation(0)).toBe(0.5);
    expect(tauxLiquidation(4)).toBeCloseTo(0.475, 10);
    expect(tauxLiquidation(30)).toBeCloseTo(0.375, 10);
    expect(trimestresManquants(172, 100)).toBe(20);
  });

  it('taux plein automatique à 67 ans', () => {
    expect(tauxLiquidation(8, 67)).toBe(0.5);
    expect(tauxLiquidation(8, 66)).toBeCloseTo(0.45, 10);
  });

  it('proratise sur les trimestres du régime général, plafonné à 1', () => {
    expect(coefficientProratisation(86, 172)).toBe(0.5);
    expect(coefficientProratisation(200, 172)).toBe(1);
  });

  it('pension mensuelle = SAM × taux × proratisation / 12', () => {
    expect(pensionCnav(36000, 0.5, 1)).toBe(1500);
    expect(pensionCnav(36000, 0.5, 0.5)).toBe(750);
  });
});
