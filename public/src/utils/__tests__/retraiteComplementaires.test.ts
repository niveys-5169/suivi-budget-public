import { describe, expect, it } from 'vitest';
import { pensionAgircArrco, pointsAgircArrcoAnnee } from '../projection/retraite/agircArrco';
import { pensionCipav, pointsCipavAnnee } from '../projection/retraite/cipav';

const OPTS = { croissancePass: 0.02, revalorisationSalaires: 0.015, prixPoint: 20 };

describe('Agirc-Arrco', () => {
  it('tranche 1 seule : assiette × 6,2 % / prix du point', () => {
    expect(pointsAgircArrcoAnnee(30000, 2026, OPTS)).toBeCloseTo((30000 * 0.062) / 20, 8);
  });

  it('tranche 2 au-delà du PASS (17 %), plafonnée à 8 PASS', () => {
    const pass = 48060;
    expect(pointsAgircArrcoAnnee(60000, 2026, OPTS)).toBeCloseTo(
      (pass * 0.062 + (60000 - pass) * 0.17) / 20,
      8,
    );
    expect(pointsAgircArrcoAnnee(1_000_000, 2026, OPTS)).toBeCloseTo(
      (pass * 0.062 + 7 * pass * 0.17) / 20,
      8,
    );
  });

  it('ramène les points en € 2026 (assiette revalorisée, PASS de l’année)', () => {
    expect(pointsAgircArrcoAnnee(30000, 2030, OPTS)).toBeCloseTo(
      (30000 * 0.062 * (1 / 1.015 ** 4)) / 20,
      8,
    );
  });

  it('pension mensuelle = points × valeur de service / 12, abattue de 1 % par trimestre manquant', () => {
    expect(pensionAgircArrco(6000, 1.4, 0)).toBeCloseTo(700, 8);
    expect(pensionAgircArrco(6000, 1.4, 4)).toBeCloseTo(700 * 0.96, 8);
  });
});

describe('Cipav', () => {
  it('proratise les points au BNC de référence, sans valeur négative', () => {
    expect(pointsCipavAnnee(17500, 380, 35000)).toBe(190);
    expect(pointsCipavAnnee(70000, 380, 35000)).toBe(760);
    expect(pointsCipavAnnee(-5000, 380, 35000)).toBe(0);
  });

  it('pension mensuelle = points × valeur du point / 12', () => {
    expect(pensionCipav(1200, 0.5)).toBe(50);
  });
});
