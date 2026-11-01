import { describe, expect, it } from 'vitest';
import {
  abattement10,
  impotBareme,
  impotFoyer,
  indiceBareme,
  partsFiscales,
} from '../projection/fiscal/baremeIr';

describe('partsFiscales', () => {
  // Enfant A : 15/06/2010 (21 ans le 15/06/2031) ; enfant B : né un 1er janvier (2020-01-01).
  const enfants = [{ dateNaissance: '2010-06-15' }, { dateNaissance: '2020-01-01' }];

  it('compte 2 parts sans enfant', () => {
    expect(partsFiscales(2030, [], 21)).toBe(2);
  });

  it('rattache un enfant tant que son âge au 1er janvier est inférieur à la limite', () => {
    expect(partsFiscales(2031, enfants, 21)).toBe(3); // A a 20 ans au 01/01/2031
    expect(partsFiscales(2032, enfants, 21)).toBe(2.5); // A a 21 ans au 01/01/2032
  });

  it('un enfant né un 1er janvier a son âge révolu ce jour-là', () => {
    expect(partsFiscales(2040, enfants, 21)).toBe(2.5); // B a 20 ans, A est détaché
    expect(partsFiscales(2041, enfants, 21)).toBe(2); // B a 21 ans
  });

  it('respecte une limite différente (25 ans)', () => {
    expect(partsFiscales(2035, enfants, 25)).toBe(3); // A a 24 ans
    expect(partsFiscales(2036, enfants, 25)).toBe(2.5); // A a 25 ans
  });

  it('ignore une date illisible', () => {
    expect(partsFiscales(2030, [{ dateNaissance: 'n/a' }], 21)).toBe(2);
  });
});

describe('abattement10', () => {
  it('applique le minimum, le taux de 10 % puis le maximum', () => {
    expect(abattement10(3000)).toBe(509);
    expect(abattement10(50000)).toBe(5000);
    expect(abattement10(200000)).toBe(14555);
  });

  it('ne dépasse pas le revenu et vaut 0 sans revenu', () => {
    expect(abattement10(100)).toBe(100);
    expect(abattement10(0)).toBe(0);
    expect(abattement10(-50)).toBe(0);
  });
});

describe('indiceBareme', () => {
  it('indexe composé depuis l’année de référence', () => {
    expect(indiceBareme(2025, 0.02, 2025)).toBe(1);
    expect(indiceBareme(2027, 0.02, 2025)).toBeCloseTo(1.0404, 10);
    expect(indiceBareme(2027, 0, 2025)).toBe(1);
  });
});

describe('impotBareme (1 part)', () => {
  it('calcule à la main : 30 000 € → 2 103,99 €', () => {
    // (30000−11600)×11 % + (30000−29579)×19 % = 2024 + 79,99
    expect(impotBareme(30000, 1)).toBeCloseTo(2103.99, 6);
  });

  it('vaut 0 sous le seuil de la 2e tranche', () => {
    expect(impotBareme(11600, 1)).toBe(0);
  });

  it('décale les seuils avec l’indice', () => {
    // 11 600 × 1,1 = 12 760 → (20000−12760)×11 %
    expect(impotBareme(20000, 1.1)).toBeCloseTo(796.4, 6);
  });
});

describe('impotFoyer', () => {
  it('couple (2 parts) sans plafonnement : IR = barème à 2 parts', () => {
    // 31 500 € par part : (31500−11600)×11 % + (31500−29579)×19 % = 2553,99 → ×2
    const r = impotFoyer({ revenuImposable: 63000, parts: 2, indiceBareme: 1 });
    expect(r.impotBrut).toBeCloseTo(5107.98, 6);
    expect(r.decote).toBe(0);
    expect(r.irNet).toBeCloseTo(5107.98, 6);
  });

  it('3 parts, plafonnement du QF inactif : impôt à 3 parts', () => {
    // 20 000 €/part → 924 ; ×3 = 2772. À 2 parts : 2×2103,99 = 4207,98 → avantage 1435,98 < 3614
    const r = impotFoyer({ revenuImposable: 60000, parts: 3, indiceBareme: 1 });
    expect(r.impotBrut).toBeCloseTo(2772, 6);
  });

  it('3 parts, plafonnement du QF actif : impôt à 2 parts − 2 × 1 807', () => {
    // 90 000 € : à 3 parts 3×2103,99 = 6311,97 ; à 2 parts 2×6603,99 = 13207,98 ; avantage 6896,01 > 3614
    const r = impotFoyer({ revenuImposable: 90000, parts: 3, indiceBareme: 1 });
    expect(r.impotBrut).toBeCloseTo(13207.98 - 3614, 6);
    expect(r.irNet).toBeCloseTo(9593.98, 6);
  });

  it('plafond indexé avec l’indice du barème', () => {
    const r = impotFoyer({ revenuImposable: 90000 * 1.1, parts: 3, indiceBareme: 1.1 });
    expect(r.impotBrut).toBeCloseTo((13207.98 - 3614) * 1.1, 4);
  });

  it('décote active : forfait − 45,25 % × impôt brut', () => {
    // brut 2772 ; décote = 1483 − 0,4525×2772 = 228,67
    const r = impotFoyer({ revenuImposable: 60000, parts: 3, indiceBareme: 1 });
    expect(r.decote).toBeCloseTo(228.67, 6);
    expect(r.irNet).toBeCloseTo(2543.33, 6);
  });

  it('décote plafonnée à l’impôt brut (IR nul)', () => {
    // 40 000 €, 3 parts : brut 572 ; 1483 − 0,4525×572 = 1224,17 > 572
    const r = impotFoyer({ revenuImposable: 40000, parts: 3, indiceBareme: 1 });
    expect(r.decote).toBeCloseTo(572, 6);
    expect(r.irNet).toBe(0);
  });

  it('décote inactive quand l’impôt est élevé', () => {
    expect(impotFoyer({ revenuImposable: 63000, parts: 2, indiceBareme: 1 }).decote).toBe(0);
  });

  it('revenu nul : IR nul', () => {
    expect(impotFoyer({ revenuImposable: 0, parts: 2, indiceBareme: 1 }).irNet).toBe(0);
  });
});
