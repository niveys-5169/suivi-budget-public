import { describe, expect, it } from 'vitest';
import { computeCalendrier, fractionsMois } from '../projection/activite/calendrier';
import { dayNumber, edate, parseDay } from '../projection/activite/dates';
import { anneeLiberal, codePhase, libellePhase } from '../projection/activite/phases';
import { activiteParams } from './activiteFixtures';

const cal = computeCalendrier({
  params: activiteParams,
  mesuresCibles: 0,
  differesJours: 57,
  dureePleinMois: 10,
  dureeTotaleMois: 36,
});
const mois = (annee: number, m: number) => dayNumber(annee, m, 1);

describe('dates', () => {
  it('numérote les jours comme le calendrier civil', () => {
    expect(parseDay('1970-01-01')).toBe(0);
    expect(parseDay('2000-03-01') - parseDay('2000-02-01')).toBe(29);
    expect(parseDay('2026-12-31') - parseDay('2026-01-01')).toBe(364);
  });

  it('EDATE borne le jour à la fin du mois et passe les années', () => {
    expect(edate(parseDay('2031-01-31'), 1)).toBe(parseDay('2031-02-28'));
    expect(edate(parseDay('2030-11-15'), 3)).toBe(parseDay('2031-02-15'));
    expect(edate(parseDay('2030-12-01'), 1)).toBe(parseDay('2031-01-01'));
    expect(edate(parseDay('2030-03-10'), -3)).toBe(parseDay('2029-12-10'));
  });
});

describe('calendrier', () => {
  it('enchaîne délai de réflexion, préavis, congé et différés', () => {
    expect(cal.finPreavis).toBe(parseDay('2030-04-10'));
    expect(cal.finConge).toBe(parseDay('2031-01-10'));
    expect(cal.premierVersementAre).toBe(parseDay('2031-03-09')); // fin du congé + 57 j + 1
    expect(cal.debutComplement).toBe(parseDay('2031-03-09')); // l'embauche (01/03) est antérieure
    expect(cal.moisDepartRetraite).toBe(parseDay('2042-06-01'));
  });

  it('sans libéral, la bascule tombe le mois suivant le départ en retraite', () => {
    expect(cal.bascule).toBe(parseDay('2042-07-01'));
    const avecLiberal = computeCalendrier({
      ...{ params: activiteParams },
      mesuresCibles: 20,
      differesJours: 57,
      dureePleinMois: 10,
      dureeTotaleMois: 36,
    });
    expect(avecLiberal.bascule).toBe(parseDay('2036-01-01'));
  });

  it('plafonne la fin du complément à la bascule et la fin du plein tarif à la fin du complément', () => {
    const court = computeCalendrier({
      params: activiteParams,
      mesuresCibles: 20,
      differesJours: 57,
      dureePleinMois: 100,
      dureeTotaleMois: 200,
    });
    expect(court.finComplement).toBe(parseDay('2036-01-01'));
    expect(court.finPleinTarif).toBe(court.finComplement);
    expect(cal.finComplement).toBeCloseTo(cal.premierVersementAre + 36 * 30.44, 9);
    expect(cal.finPleinTarif).toBeCloseTo(cal.debutComplement + 10 * 30.44, 9);
  });
});

describe('fractions de mois', () => {
  it('coupe le mois de fin de préavis jour par jour (avril : 30 jours)', () => {
    const f = fractionsMois(mois(2030, 4), cal, false);
    expect(f.emploi).toBeCloseTo(9 / 30, 12);
    expect(f.conge).toBeCloseTo(21 / 30, 12);
  });

  it('coupe le mois de fin de congé entre congé et trou (janvier : 31 jours)', () => {
    const f = fractionsMois(mois(2031, 1), cal, false);
    expect(f.conge).toBeCloseTo(9 / 31, 12);
    expect(f.trou).toBeCloseTo(22 / 31, 12);
    expect(fractionsMois(mois(2031, 2), cal, false).trou).toBe(1);
  });

  it("répartit mars 2031 entre différé ARE (jusqu'au 09/03) et complément plein tarif", () => {
    const f = fractionsMois(mois(2031, 3), cal, false);
    expect(f.association).toBe(1);
    expect(f.differeAre).toBeCloseTo(8 / 31, 12);
    expect(f.arePlein).toBeCloseTo(23 / 31, 12);
  });

  it('passe du plein tarif au dégressif à la fin de la phase pleine', () => {
    const f = fractionsMois(mois(2032, 1), cal, false);
    expect(f.arePlein + f.areDegressif).toBeCloseTo(1, 12);
    expect(f.areDegressif).toBeGreaterThan(0);
    expect(f.arePlein).toBeGreaterThan(0);
  });

  it('annule association et libéral une fois à la retraite', () => {
    const f = fractionsMois(mois(2042, 8), cal, true);
    expect(f.association).toBe(0);
    expect(f.liberal).toBe(0);
  });
});

describe('phases', () => {
  const mesures = [10, 15, 20];

  it('donne le code et le libellé de chaque phase (milieu de mois)', () => {
    const lib = (annee: number, m: number, retraite = false) => {
      const d = mois(annee, m);
      const code = codePhase(d, cal, retraite, anneeLiberal(annee, 2036));
      return `${code} ${libellePhase(code, d, cal, mesures)}`;
    };
    expect(lib(2030, 3)).toBe('1 Situation actuelle');
    expect(lib(2030, 4)).toBe('2 Congé de reclassement'); // 01/04 + 14 j = 15/04 > fin de préavis
    expect(lib(2031, 2)).toBe('2 Congé de reclassement'); // le trou garde le code 2
    expect(lib(2031, 3)).toBe('3 Association + complément ARE'); // 15/03 > 09/03 : complément ouvert
    const calLong = { ...cal, debutComplement: parseDay('2031-04-01') };
    const code = codePhase(mois(2031, 3), calLong, false, 1);
    expect(libellePhase(code, mois(2031, 3), calLong, mesures)).toBe('Association (différé ARE)');
    expect(lib(2032, 6)).toBe('3 Association + complément ARE');
    expect(lib(2043, 1, true)).toBe('8 Retraite');
  });

  it("l'année de libéral monte de 1 à 3 selon l'année civile (années 1 et 2 communes)", () => {
    expect([2036, 2037, 2038, 2039, 2045].map((a) => anneeLiberal(a, 2036))).toEqual([
      1, 1, 2, 3, 3,
    ]);
  });
});
