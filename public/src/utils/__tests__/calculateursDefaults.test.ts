import { describe, expect, it } from 'vitest';
import type { ProjectionParams } from '../../types/banking.types';
import { createDefaultProjectionParams } from '../projection/defaults';
import { createDefaultCalculateurs } from '../projection/calculateurs/defaults';
import { computeScenarioCalcule } from '../projection/calculateurs/computeScenarioCalcule';
import { personnesCalculees } from '../projection/calculateurs/personnesCalculees';
import { makeCalculateursParams } from './calculateursFixtures';

const base = (): ProjectionParams => createDefaultProjectionParams(new Date(2030, 0, 1));

describe('createDefaultCalculateurs', () => {
  it('crée trois blocs génériques, inactifs, sans donnée personnelle', () => {
    const params = base();
    const calc = createDefaultCalculateurs(params);
    expect(calc.actif).toBe(false);
    expect(calc.fiscal).toMatchObject({
      indexationBareme: { mode: 'inflation' },
      ageLimiteRattachement: 21,
      premiereAnneeRecalculee: 2031,
      tauxReelsActuels: { p1: 0, p2: 0 },
    });
    expect(calc.retraite!.personnes.map((p) => p.personneId)).toEqual(['p1', 'p2']);
    expect(calc.retraite!.personnes[0]).toMatchObject({
      trimestresValides: 0,
      anneeReleve: 2029,
      trimestresRequis: 172,
      pointsAgircArrco: 0,
      nombreMeilleuresAnnees: 25,
    });
    expect(calc.activite!.paie.netAvantPas).toBe(0);
    expect(calc.activite!.calendrier.dateNotification).toBe('2030-01-01');
    expect(calc.activite!.liberal.charges).toEqual([]);
  });

  it('une mesure cible nulle par scénario existant', () => {
    const params = base();
    params.scenarios.push({ id: 's2', nom: 'Autre', phases: [], pensions: [] });
    expect(createDefaultCalculateurs(params).activite!.scenarios).toEqual({ s1: 0, s2: 0 });
  });

  it('reprend les dates et âges de la personne 1 quand ils existent', () => {
    const params = base();
    params.personnes[0] = {
      id: 'p1',
      prenom: 'A',
      dateNaissance: '1975-05-05',
      ageFinActivite: 63,
    };
    expect(createDefaultCalculateurs(params).activite!.personne1).toEqual({
      dateNaissance: '1975-05-05',
      ageDepartRetraite: 63,
    });
  });

  it('ajoute la personne 2 seulement si le foyer en compte une', () => {
    const params = base();
    expect(createDefaultCalculateurs(params).activite!.personne2).toBeDefined();
    params.personnes = params.personnes.slice(0, 1);
    expect(createDefaultCalculateurs(params).activite!.personne2).toBeUndefined();
  });

  it('conserve les blocs et l’interrupteur déjà présents', () => {
    const params = makeCalculateursParams();
    const existing = params.calculateurs!;
    delete existing.retraite;
    const calc = createDefaultCalculateurs(params);
    expect(calc.actif).toBe(true);
    expect(calc.fiscal).toBe(existing.fiscal);
    expect(calc.activite).toBe(existing.activite);
    expect(calc.retraite!.personnes).toHaveLength(2);
  });

  it('donne des paramètres calculables (aucune valeur non finie)', () => {
    const params = base();
    params.calculateurs = createDefaultCalculateurs(params);
    const calcule = computeScenarioCalcule(params, 's1');
    expect(calcule).toBeDefined();
    const valeurs = Object.values(calcule!.revenusMensuels).flatMap((m) => Object.values(m));
    expect(valeurs.length).toBeGreaterThan(0);
    expect(valeurs.every(Number.isFinite)).toBe(true);
  });
});

describe('personnesCalculees', () => {
  it('liste les personnes dont les revenus viennent des calculateurs', () => {
    const params = makeCalculateursParams();
    expect(personnesCalculees(params).map((p) => p.id)).toEqual(['p1', 'p2']);
    delete params.calculateurs!.activite!.personne2;
    expect(personnesCalculees(params).map((p) => p.id)).toEqual(['p1']);
  });

  it('est vide si les calculateurs sont inactifs, absents ou incomplets', () => {
    const params = makeCalculateursParams();
    params.calculateurs!.actif = false;
    expect(personnesCalculees(params)).toEqual([]);
    delete params.calculateurs;
    expect(personnesCalculees(params)).toEqual([]);
    const incomplet = makeCalculateursParams();
    delete incomplet.calculateurs!.fiscal;
    expect(personnesCalculees(incomplet)).toEqual([]);
  });
});
