import { describe, expect, it } from 'vitest';
import { round3, tauxGrilleDefaut, tauxPasAnnee } from '../projection/fiscal/tauxPas';

describe('round3', () => {
  it('arrondit au 1/1000, la moitié vers le haut', () => {
    expect(round3(5304 / 48000)).toBe(0.111); // 0,1105
    expect(round3(0.0734)).toBe(0.073);
    expect(round3(0)).toBe(0);
  });
});

describe('tauxGrilleDefaut', () => {
  it('prend le taux de la dernière borne atteinte', () => {
    expect(tauxGrilleDefaut(0, 2026, 0)).toBe(0);
    expect(tauxGrilleDefaut(2000, 2026, 0)).toBe(0.029);
    expect(tauxGrilleDefaut(2060, 2026, 0)).toBe(0.035); // seuil inclus
    expect(tauxGrilleDefaut(100000, 2026, 0)).toBe(0.43);
  });

  it('indexe les seuils depuis l’année de la grille', () => {
    // seuil 2 170 × 1,0404 = 2 257,7 : 2 200 € reste sur la tranche précédente en 2028
    expect(tauxGrilleDefaut(2200, 2026, 0.02)).toBe(0.041);
    expect(tauxGrilleDefaut(2200, 2028, 0.02)).toBe(0.035);
  });
});

describe('tauxPasAnnee', () => {
  const base = { annee: 2026, indexation: 0, tauxIndividualises: true };

  it('P1 moins payé : grille pour P1, complément pour P2, arrondi au 1/1000', () => {
    // foyer = 6000/72000 = 8,3 % ; base P1 = 2000 €/mois → grille 2,9 % ; P2 = (6000−24000×2,9 %)/48000 = 11,05 % → 11,1 %
    const r = tauxPasAnnee({ ...base, revenuP1: 24000, revenuP2: 48000, irNet: 6000 });
    expect(r).toEqual({ tauxFoyer: 0.083, tauxP1: 0.029, tauxP2: 0.111 });
  });

  it('P2 moins payé : grille pour P2, complément pour P1', () => {
    // base P2 = 2000 €/mois → 2,9 % ; P1 = (6000−24000×2,9 %)/48000 → 11,1 %
    const r = tauxPasAnnee({ ...base, revenuP1: 48000, revenuP2: 24000, irNet: 6000 });
    expect(r).toEqual({ tauxFoyer: 0.083, tauxP1: 0.111, tauxP2: 0.029 });
  });

  it('plafonne le taux du moins payé au taux du foyer', () => {
    // foyer = 1000/122000 → 0,8 % ; grille (5 000 €/mois) 17,9 % → plafonné à 0,8 %
    const r = tauxPasAnnee({ ...base, revenuP1: 60000, revenuP2: 62000, irNet: 1000 });
    expect(r.tauxP1).toBe(0.008);
    expect(r.tauxP2).toBe(0.008);
  });

  it('égalité de revenus : P1 est le moins payé', () => {
    const r = tauxPasAnnee({ ...base, revenuP1: 36000, revenuP2: 36000, irNet: 3600 });
    // foyer 5 % ; grille à 3 000 €/mois = 7,5 % → plafonné 5 % ; P2 = (3600−1800)/36000 = 5 %
    expect(r).toEqual({ tauxFoyer: 0.05, tauxP1: 0.05, tauxP2: 0.05 });
  });

  it('mode commun : taux du foyer pour les deux', () => {
    const r = tauxPasAnnee({
      ...base,
      tauxIndividualises: false,
      revenuP1: 24000,
      revenuP2: 48000,
      irNet: 6000,
    });
    expect(r).toEqual({ tauxFoyer: 0.083, tauxP1: 0.083, tauxP2: 0.083 });
  });

  it('revenus nuls : taux nuls', () => {
    const r = tauxPasAnnee({ ...base, revenuP1: 0, revenuP2: 0, irNet: 0 });
    expect(r).toEqual({ tauxFoyer: 0, tauxP1: 0, tauxP2: 0 });
  });

  it('sans revenu pour l’une des personnes : repli sur le taux du foyer', () => {
    const r = tauxPasAnnee({ ...base, revenuP1: 30000, revenuP2: 0, irNet: 1500 });
    // P2 (0) est le moins payé : base 0 → grille 0 % ; P1 reçoit (1500 − 0)/30000 = 5 %
    expect(r).toEqual({ tauxFoyer: 0.05, tauxP1: 0.05, tauxP2: 0 });
  });
});
