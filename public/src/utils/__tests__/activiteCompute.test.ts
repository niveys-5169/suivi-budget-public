import { describe, expect, it } from 'vitest';
import { computeAre } from '../projection/activite/are';
import {
  computeActivitePersonne1,
  type ActiviteInput,
} from '../projection/activite/computeActivite';
import { allocationReclassementNette } from '../projection/activite/reclassement';
import { brutMensuelAn1, computeComplementAre } from '../projection/activite/salariat';
import type { ProjectionActiviteMois, ProjectionActiviteParams } from '../../types/banking.types';
import { activiteParams } from './activiteFixtures';

const input = (
  extra: Partial<ActiviteInput> = {},
  params: ProjectionActiviteParams = activiteParams,
) => ({
  horizon: { debut: '2030-02', fin: '2043-12' },
  params,
  ...extra,
});
const parMois = (lignes: ProjectionActiviteMois[], mois: string) => {
  const ligne = lignes.find((l) => l.mois === mois);
  if (!ligne) throw new Error(`mois absent : ${mois}`);
  return ligne;
};

const allocation = allocationReclassementNette(activiteParams.reclassement);
const are = computeAre(200);
const brutAn1 = brutMensuelAn1(activiteParams.ccn66);
const complement = computeComplementAre(are, brutAn1);
const netSalaire = brutAn1 * (1 - 0.2);

describe("computeActivitePersonne1 — association jusqu'à la retraite", () => {
  const lignes = computeActivitePersonne1(input(), 'association');

  it("couvre chaque mois de l'horizon, bornes incluses", () => {
    expect(lignes).toHaveLength(13 * 12 + 11);
    expect(lignes[0]!.mois).toBe('2030-02');
    expect(lignes.at(-1)!.mois).toBe('2043-12');
  });

  it('paie le salaire actuel lissé avant le préavis, avec son net imposable', () => {
    const m = parMois(lignes, '2030-03');
    expect(m.phase).toBe('Situation actuelle');
    expect(m.netAvantPas).toBe(3000);
    expect(m.netImposable).toBe(3300);
  });

  it('partage le mois de fin de préavis entre salaire (9/30) et allocation (21/30)', () => {
    const m = parMois(lignes, '2030-04');
    expect(m.netAvantPas).toBeCloseTo(0.3 * 3000 + 0.7 * allocation, 8);
    expect(m.netImposable).toBeCloseTo(0.3 * 3300 + 0.7 * allocation, 8);
  });

  it("verse l'allocation de reclassement nette pendant le congé", () => {
    const m = parMois(lignes, '2030-09');
    expect(m.phase).toBe('Congé de reclassement');
    expect(m.netAvantPas).toBeCloseTo(allocation, 8);
  });

  it("isole le trou de revenu avant l'embauche : rien dans le net, tout dans le revenu manquant", () => {
    const m = parMois(lignes, '2031-02');
    expect(m.netAvantPas).toBe(0);
    expect(m.fractions.trou).toBe(1);
    expect(m.revenuManquantNet).toBeCloseTo(netSalaire, 8);
  });

  it('enchaîne différé ARE (8/31), puis complément ARE plein tarif cumulé avec le salaire', () => {
    const m = parMois(lignes, '2031-03');
    expect(m.fractions.differeAre).toBeCloseTo(8 / 31, 12);
    expect(m.revenuManquantNet).toBeCloseTo((8 / 31) * complement.netPlein, 8);
    expect(m.netAvantPas).toBeCloseTo(netSalaire + (23 / 31) * complement.netPlein, 8);
    const plein = parMois(lignes, '2031-07');
    expect(plein.phase).toBe('Association + complément ARE');
    expect(plein.netAvantPas).toBeCloseTo(netSalaire + complement.netPlein, 8);
    expect(plein.netImposable).toBeCloseTo((netSalaire * 3300) / 3000 + complement.netPlein, 8);
  });

  it('passe en complément dégressif, puis plus aucun complément quand les droits sont épuisés', () => {
    const degressif = parMois(lignes, '2032-06');
    expect(degressif.fractions.arePlein).toBe(0);
    expect(degressif.netAvantPas).toBeCloseTo(netSalaire * 1.02 + complement.netDegressif, 8);
    const epuise = parMois(lignes, '2035-01');
    expect(epuise.phase).toBe('Association sans ARE');
    expect(epuise.netAvantPas).toBeCloseTo(netSalaire * 1.02 ** 3, 8); // 4e année d'association
  });

  it("augmente le salaire à chaque anniversaire de l'embauche (année d'association k)", () => {
    expect(parMois(lignes, '2031-12').anneeAssociation).toBe(0);
    expect(parMois(lignes, '2032-02').anneeAssociation).toBe(0);
    expect(parMois(lignes, '2032-03').anneeAssociation).toBe(1);
    expect(parMois(lignes, '2032-03').netSalaireAssociation).toBeCloseTo(netSalaire * 1.02, 8);
    expect(parMois(lignes, '2034-03').netSalaireAssociation).toBeCloseTo(netSalaire * 1.02 ** 3, 8);
  });

  it("s'arrête à la retraite : dernier mois d'activité = mois de l'âge de départ", () => {
    expect(parMois(lignes, '2042-06').netAvantPas).toBeGreaterThan(0);
    const retraite = parMois(lignes, '2042-07');
    expect(retraite.phase).toBe('Retraite');
    expect(retraite.codePhase).toBe(8);
    expect(retraite.netAvantPas).toBe(0);
    expect(retraite.netImposable).toBe(0);
    expect(parMois(lignes, '2043-12').netSalaireAssociation).toBeGreaterThan(0); // mémo : colonne AR
  });

  it('sans libéral, aucun BNC ni PER', () => {
    expect(lignes.every((l) => l.bncImposable === 0 && l.per === 0)).toBe(true);
  });

  it("un id de scénario inconnu est traité comme l'association", () => {
    const autres = computeActivitePersonne1(input(), 'inconnu');
    expect(parMois(autres, '2038-01').phase).toBe(parMois(lignes, '2038-01').phase);
  });
});

describe('computeActivitePersonne1 — libéral', () => {
  const lignes = computeActivitePersonne1(input(), 'liberal');

  it("reste en association jusqu'à la bascule, puis monte en charge sur 3 ans", () => {
    expect(parMois(lignes, '2035-12').phase).toBe('Association sans ARE');
    expect(parMois(lignes, '2036-01').phase).toBe('Libéral — 10 mesures');
    expect(parMois(lignes, '2037-12').phase).toBe('Libéral — 10 mesures'); // années 1 et 2 communes
    expect(parMois(lignes, '2038-06').phase).toBe('Libéral — 15 mesures');
    expect(parMois(lignes, '2039-06').phase).toBe('Libéral — 20 mesures');
  });

  it('verse le BNC moins cotisations en net, le BNC après PER en imposable et le PER en sortie', () => {
    const m = parMois(lignes, '2036-01');
    expect(m.liberalNetAvantImpot).toBeCloseTo((9000 - 3090.24) / 12, 8);
    expect(m.netAvantPas).toBeCloseTo((9000 - 3090.24) / 12, 8);
    expect(m.bncImposable).toBeCloseTo((9000 - 3090.24 - 1200) / 12, 8);
    expect(m.netImposable).toBeCloseTo((9000 - 3090.24 - 1200) / 12, 8);
    expect(m.netImposableHorsLiberal).toBe(0);
    expect(m.per).toBe(100);
  });

  it("ne verse plus de salaire d'association ni de complément après la bascule", () => {
    const m = parMois(lignes, '2040-01');
    expect(m.fractions.association).toBe(0);
    expect(m.fractions.liberal).toBe(1);
  });

  it('coupe le complément ARE à la bascule si les droits courent plus longtemps', () => {
    const courte = {
      ...activiteParams,
      calendrier: { ...activiteParams.calendrier, dateBasculeLiberal: '2032-07-01' },
    };
    const l = computeActivitePersonne1(input({}, courte), 'liberal');
    expect(parMois(l, '2032-08').fractions.areDegressif).toBe(0);
    expect(parMois(l, '2032-08').phase).toBe('Libéral — 10 mesures');
  });

  it('arrête le libéral à la retraite', () => {
    const m = parMois(lignes, '2042-07');
    expect(m.phase).toBe('Retraite');
    expect(m.netAvantPas).toBe(0);
    expect(m.per).toBe(0);
  });
});

describe('computeActivitePersonne1 — revenu manquant et personne 2', () => {
  it("retire le PAS (taux de l'année × assiette imposable) du revenu manquant", () => {
    const l = computeActivitePersonne1(input({ tauxPasParAnnee: { 2031: 0.1 } }), 'association');
    const m = parMois(l, '2031-02');
    expect(m.revenuManquant).toBeCloseTo(netSalaire * (1 - 0.1 * 1.1), 8); // ratio imposable/net 3300/3000
    expect(m.revenuManquantImposable).toBeCloseTo(netSalaire * 1.1, 8);
  });

  it("revalorise le salaire de la personne 2 chaque 1er janvier jusqu'à sa fin d'activité", () => {
    const params = {
      ...activiteParams,
      personne2: {
        dateNaissance: '1982-03-10',
        ageFinActivite: 60, // dernier mois payé : 2042-02
        netAvantPasMensuel: 2000,
        netImposableMensuel: 2200,
        revalorisationAnnuelle: 0.01,
        anneeReference: 2030,
      },
    };
    const l = computeActivitePersonne1(input({}, params), 'association');
    expect(parMois(l, '2030-05').netAvantPasPersonne2).toBe(2000);
    expect(parMois(l, '2032-01').netAvantPasPersonne2).toBeCloseTo(2000 * 1.01 ** 2, 8);
    expect(parMois(l, '2032-01').netImposablePersonne2).toBeCloseTo(2200 * 1.01 ** 2, 8);
    expect(parMois(l, '2042-02').netAvantPasPersonne2).toBeGreaterThan(0);
    expect(parMois(l, '2042-03').netAvantPasPersonne2).toBe(0);
    expect(
      parMois(computeActivitePersonne1(input(), 'association'), '2030-05').netAvantPasPersonne2,
    ).toBe(0);
  });
});
