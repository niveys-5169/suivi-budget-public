import { describe, it, expect } from 'vitest';
import type {
  ProjectionParams,
  ProjectionPhaseRevenu,
  ProjectionValeursObservees,
} from '../../types/banking.types';
import { createDefaultProjectionParams } from '../projection/defaults';
import { describeAutoValue, resolveProjectionParams } from '../projection/resolveParams';

const observed = (over: Partial<ProjectionValeursObservees> = {}): ProjectionValeursObservees => ({
  periode: { debut: '2025-03-01', fin: '2026-02-28' },
  budgetReference: 4000,
  detailCategories: [],
  moyenneMensuelleParCategorie: { 'Salaire A': 2000, 'Prime A': 100, CAF: 250 },
  credits: { c1: { mensualite: 500, fin: '2030-06', tauxAnnuel: 2.5, libelle: 'Prêt observé' } },
  patrimoineHorsPer: 50000,
  epargneNetteMensuelle: 300,
  ...over,
});

const phase = (over: Partial<ProjectionPhaseRevenu> = {}): ProjectionPhaseRevenu => ({
  id: 'ph1',
  personneId: 'p1',
  libelle: 'Activité',
  debut: '2026-11',
  netMensuel: { mode: 'auto' },
  revalorisationAnnuelle: 0.01,
  ...over,
});

const params = (over: Partial<ProjectionParams> = {}): ProjectionParams => ({
  ...createDefaultProjectionParams(new Date(2026, 10, 1)),
  ...over,
});

describe('describeAutoValue', () => {
  it('auto avec valeur observée', () => {
    expect(describeAutoValue({ mode: 'auto', manuel: 1 }, 42)).toEqual({
      valeur: 42,
      source: 'auto',
    });
  });
  it('auto indisponible : repli sur le manuel ou 0', () => {
    expect(describeAutoValue({ mode: 'auto', manuel: 7 }, null)).toEqual({
      valeur: 7,
      source: 'auto-indisponible',
    });
    expect(describeAutoValue({ mode: 'auto' }, null)).toEqual({
      valeur: 0,
      source: 'auto-indisponible',
    });
  });
  it('manuel prioritaire même si une valeur est observée', () => {
    expect(describeAutoValue({ mode: 'manuel', manuel: 9 }, 42)).toEqual({
      valeur: 9,
      source: 'manuel',
    });
    expect(describeAutoValue({ mode: 'manuel' }, 42)).toEqual({ valeur: 0, source: 'manuel' });
  });
});

describe('resolveProjectionParams', () => {
  it('budget et patrimoine : auto, manuel, indisponible', () => {
    const p = params();
    p.depenses.budgetReference = { mode: 'auto' };
    p.capital.patrimoineDepart = { mode: 'manuel', manuel: 1234 };
    const r = resolveProjectionParams(p, observed());
    expect(r.budgetReference).toBe(4000);
    expect(r.patrimoineDepart).toBe(1234);
    const r2 = resolveProjectionParams(p, observed({ budgetReference: null }));
    expect(r2.budgetReference).toBe(0);
  });

  it('phase auto : somme des moyennes des catégories sources', () => {
    const p = params();
    p.revenusCommuns.phases = [phase({ categoriesSource: ['Salaire A', 'Prime A'] })];
    const r = resolveProjectionParams(p, observed());
    expect(r.phasesCommunes[0]?.netMensuel).toBe(2100);
    expect(r.phasesCommunes[0]?.libelle).toBe('Activité');
  });

  it('phase auto sans catégorie observée ou sans source : repli manuel', () => {
    const p = params();
    p.revenusCommuns.phases = [
      phase({
        id: 'a',
        categoriesSource: ['Inconnue'],
        netMensuel: { mode: 'auto', manuel: 1800 },
      }),
      phase({ id: 'b', netMensuel: { mode: 'auto' } }),
      phase({
        id: 'c',
        categoriesSource: ['Salaire A'],
        netMensuel: { mode: 'manuel', manuel: 1500 },
      }),
    ];
    const r = resolveProjectionParams(p, observed());
    expect(r.phasesCommunes.map((x) => x.netMensuel)).toEqual([1800, 0, 1500]);
  });

  it('phases des scénarios résolues', () => {
    const p = params();
    p.scenarios = [
      { id: 's1', nom: 'S1', phases: [phase({ categoriesSource: ['Salaire A'] })], pensions: [] },
    ];
    const r = resolveProjectionParams(p, observed());
    expect(r.scenarios[0]?.phases[0]?.netMensuel).toBe(2000);
  });

  it('CAF auto par catégories, manuel sinon', () => {
    const p = params();
    p.revenusCommuns.caf = {
      montant: { mode: 'auto' },
      categoriesSource: ['CAF'],
      evolutionAnnuelle: 0.01,
    };
    expect(resolveProjectionParams(p, observed()).caf).toEqual({
      montant: 250,
      evolutionAnnuelle: 0.01,
    });
    p.revenusCommuns.caf.montant = { mode: 'manuel', manuel: 80 };
    expect(resolveProjectionParams(p, observed()).caf.montant).toBe(80);
  });

  it('CAF dernierMois : mois précédant les 20 ans de l’aîné', () => {
    const p = params();
    p.enfants = [
      { id: 'e2', dateNaissance: '2015-01-10' },
      { id: 'e1', dateNaissance: '2010-05-20' },
    ];
    p.revenusCommuns.caf.arretAuxAnsAine = 20;
    expect(resolveProjectionParams(p, observed()).caf.dernierMois).toBe('2030-04');
    p.revenusCommuns.caf.arretAuxAnsAine = undefined;
    expect(resolveProjectionParams(p, observed()).caf.dernierMois).toBeUndefined();
    p.revenusCommuns.caf.arretAuxAnsAine = 20;
    p.enfants = [];
    expect(resolveProjectionParams(p, observed()).caf.dernierMois).toBeUndefined();
  });

  it('CAF dernierMois : naissance en janvier recule sur décembre', () => {
    const p = params();
    p.enfants = [{ id: 'e1', dateNaissance: '2012-01-05' }];
    p.revenusCommuns.caf.arretAuxAnsAine = 18;
    expect(resolveProjectionParams(p, observed()).caf.dernierMois).toBe('2029-12');
  });

  it('crédit auto lié : valeurs observées ; remboursement anticipé recopié', () => {
    const p = params();
    p.depenses.credits = [
      {
        id: 'k1',
        libelle: 'Prêt A',
        creditId: 'c1',
        mode: 'auto',
        mensualiteManuelle: 1,
        remboursementAnticipe: { mois: '2028-01', frais: 100 },
      },
    ];
    const r = resolveProjectionParams(p, observed());
    expect(r.credits).toEqual([
      {
        id: 'k1',
        libelle: 'Prêt A',
        mensualite: 500,
        fin: '2030-06',
        tauxAnnuel: 2.5,
        remboursementAnticipe: { mois: '2028-01', frais: 100 },
      },
    ]);
  });

  it('crédit auto non trouvé ou manuel : valeurs manuelles, mensualité 0 par défaut', () => {
    const p = params();
    p.depenses.credits = [
      {
        id: 'k1',
        libelle: 'Absent',
        creditId: 'zz',
        mode: 'auto',
        mensualiteManuelle: 300,
        finManuelle: '2029-01',
        tauxAnnuelManuel: 3,
      },
      { id: 'k2', libelle: 'Manuel', creditId: 'c1', mode: 'manuel' },
    ];
    const r = resolveProjectionParams(p, observed());
    expect(r.credits[0]).toMatchObject({ mensualite: 300, fin: '2029-01', tauxAnnuel: 3 });
    expect(r.credits[1]).toMatchObject({ mensualite: 0, tauxAnnuel: 0 });
    expect(r.credits[1]?.fin).toBeUndefined();
  });

  it('recopie des champs sans résolution', () => {
    const p = params();
    p.capital.capitalInitial = 10;
    const r = resolveProjectionParams(p, observed());
    expect(r.capitalInitial).toBe(10);
    expect(r.horizon).toEqual(p.horizon);
    expect(r.macro).toEqual(p.macro);
  });
});
