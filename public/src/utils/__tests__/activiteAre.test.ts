import { describe, expect, it } from 'vitest';
import { computeAre, computeDifferesJours } from '../projection/activite/are';
import {
  allocationReclassementNette,
  partSalarialeAgircArrco,
} from '../projection/activite/reclassement';
import {
  brutMensuelAn1,
  computeComplementAre,
  netSalaireAssociation,
} from '../projection/activite/salariat';
import { activiteParams } from './activiteFixtures';

describe('ARE (⑥)', () => {
  it('retient la formule 2 (57 % du SJR) quand elle dépasse la formule 1, sans dégressivité sous 92,57 €', () => {
    const are = computeAre(100); // F1 = 53,58 ; F2 = 57 ; plafond 75
    expect(are.allocationJournaliere).toBeCloseTo(57, 10);
    expect(are.degressiviteApplicable).toBe(false);
    expect(are.allocationDegressive).toBe(are.allocationJournaliere);
  });

  it("plafonne l'allocation à 75 % du SJR", () => {
    expect(computeAre(20).allocationJournaliere).toBeCloseTo(15, 10); // F1 = 21,26
  });

  it('applique −30 % avec un plancher de 92,57 €/j à partir de ce seuil', () => {
    const bas = computeAre(200); // AJ = 114 → 79,8 < plancher
    expect(bas.degressiviteApplicable).toBe(true);
    expect(bas.allocationDegressive).toBeCloseTo(92.57, 10);
    const haut = computeAre(300); // AJ = 171 → 119,7
    expect(haut.allocationDegressive).toBeCloseTo(119.7, 10);
  });

  it('prélève 3 % du SJR et CSG/CRDS 6,7 % sur 98,25 % pour obtenir la nette (×30 j)', () => {
    const are = computeAre(200);
    const prelevementMensuel = 30 * (200 * 0.03 + 114 * 0.067 * 0.9825);
    expect(are.netMensuelPlein).toBeCloseTo(114 * 30 - prelevementMensuel, 8);
    expect(are.tauxPrelevements).toBeCloseTo(prelevementMensuel / (114 * 30), 12);
    expect(are.netMensuelDegressif).toBeCloseTo(92.57 * 30 * (1 - are.tauxPrelevements), 8);
  });
});

describe("différés d'indemnisation (① B40:B43)", () => {
  it("additionne différé spécifique, congés payés et 7 jours d'attente", () => {
    expect(computeDifferesJours({ ...activiteParams.are })).toBeCloseTo(57, 10); // 40 + 10 + 7
  });

  it('plafonne le spécifique à 75 jours et les congés payés à 30 jours', () => {
    expect(computeDifferesJours({ assietteSupralegale: 50000, iccpBrute: 100000, sjr: 200 })).toBe(
      75 + 30 + 7,
    );
  });
});

describe('congé de reclassement (① B51:B53, B183:B186)', () => {
  it('prélève la part salariale Agirc-Arrco en tranche 1 sous le PASS mensuel', () => {
    expect(partSalarialeAgircArrco(4000)).toBeCloseTo(4000 * (0.0315 + 0.0086), 10);
  });

  it('ajoute tranche 2 et CET au-delà du PASS mensuel (48 060 / 12)', () => {
    const attendu = 4005 * 0.0401 + 995 * 0.0972 + 5000 * 0.0014;
    expect(partSalarialeAgircArrco(5000)).toBeCloseTo(attendu, 10);
  });

  it('nette = brut × taux × (1 − CSG/CRDS) − part salariale', () => {
    const net = allocationReclassementNette(activiteParams.reclassement);
    expect(net).toBeCloseTo(3500 * (1 - 0.0658275) - 160.4, 10);
  });
});

describe('salariat CCN 66 (②b)', () => {
  it('relève au SMIC un salaire indiciaire inférieur et ajoute la CTI', () => {
    expect(brutMensuelAn1(activiteParams.ccn66)).toBeCloseTo(1867.02 + 200, 10);
  });

  it('retient le salaire indiciaire (coef × point × 1,0921) quand il dépasse le SMIC', () => {
    expect(brutMensuelAn1({ ...activiteParams.ccn66, coefficient: 600 })).toBeCloseTo(
      4 * 600 * 1.0921 + 200,
      10,
    );
  });

  it("progresse de 2 % par année d'association, net de cotisations", () => {
    const an1 = netSalaireAssociation(activiteParams.ccn66, 0);
    expect(an1).toBeCloseTo((1867.02 + 200) * 0.8, 10);
    expect(netSalaireAssociation(activiteParams.ccn66, 1)).toBeCloseTo(an1 * 1.02, 10);
    expect(netSalaireAssociation(activiteParams.ccn66, 3)).toBeCloseTo(an1 * 1.02 ** 3, 10);
  });
});

describe('cumul ARE + salaire à 70 % (②b B26:B32)', () => {
  const are = computeAre(200);
  const brut = 1867.02 + 200;

  it("réduit l'ARE de 70 % du brut repris, en plein tarif puis en dégressif", () => {
    const c = computeComplementAre(are, brut);
    expect(c.brutPlein).toBeCloseTo(114 * 30 - 0.7 * brut, 8);
    expect(c.brutDegressif).toBeCloseTo(92.57 * 30 - 0.7 * brut, 8);
    expect(c.netPlein).toBeCloseTo(c.brutPlein * (1 - are.tauxPrelevements), 8);
  });

  it('étale les droits (182 j pleins, 366 j dégressifs) sur le complément mensuel', () => {
    const c = computeComplementAre(are, brut);
    expect(c.dureePleinMois).toBeCloseTo((182 * 114) / c.brutPlein, 8);
    expect(c.dureeDegressifMois).toBeCloseTo((366 * 92.57) / c.brutDegressif, 8);
    expect(c.dureeTotaleMois).toBeCloseTo(c.dureePleinMois + c.dureeDegressifMois, 8);
  });

  it("ne verse aucun complément si 70 % du brut dépasse l'allocation", () => {
    const c = computeComplementAre(computeAre(50), brut);
    expect(c.brutPlein).toBe(0);
    expect(c.dureeTotaleMois).toBe(0);
  });

  it('plafonne la durée au délai de déchéance de 54 mois', () => {
    const c = computeComplementAre(computeAre(100), 2400); // 1 710 − 1 680 = 30 €/mois
    expect(c.brutPlein).toBeCloseTo(30, 8);
    expect(c.dureeTotaleMois).toBe(54);
  });
});
