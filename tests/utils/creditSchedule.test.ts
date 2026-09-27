import { describe, it, expect } from 'vitest';
import {
  mensualite,
  capitalRestantDu,
  dateFin,
  liberationsParAnnee,
  tauxEndettement,
  couverture,
  anneeCouverture,
  mensualitesEnCours,
} from '../../public/src/utils/creditSchedule';
import type { Credit } from '../../public/src/types/banking.types';

const makeCredit = (overrides: Partial<Credit> = {}): Credit => ({
  id: 'c1',
  nom: 'Crédit Maison',
  owner: 'Commun',
  capitalInitial: 200000,
  tauxAnnuel: 1.5,
  dureeMois: 240,
  dateDebut: '2020-01-01',
  ...overrides,
});

describe('mensualite', () => {
  it('computes the constant payment for a known case (200 000 € @ 1.5 % / 240 mois)', () => {
    const credit = makeCredit();
    expect(mensualite(credit)).toBeCloseTo(965.09, 2);
  });

  it('falls back to capital / duree when the rate is 0 %', () => {
    const credit = makeCredit({ tauxAnnuel: 0, capitalInitial: 24000, dureeMois: 24 });
    expect(mensualite(credit)).toBeCloseTo(1000, 6);
  });
});

describe('capitalRestantDu', () => {
  it('returns the initial capital before the start date', () => {
    const credit = makeCredit();
    expect(capitalRestantDu(credit, new Date('2019-12-01'))).toBe(200000);
  });

  it('decreases partway through the loan', () => {
    const credit = makeCredit();
    const crd = capitalRestantDu(credit, new Date('2029-12-01')); // 120 payments made
    expect(crd).toBeGreaterThan(0);
    expect(crd).toBeLessThan(200000);
    // Amortization sanity check against the closed-form outstanding-balance formula.
    expect(crd).toBeCloseTo(107481.31, 1);
  });

  it('reaches 0 at and after the end of the loan', () => {
    const credit = makeCredit();
    const end = dateFin(credit);
    expect(capitalRestantDu(credit, end)).toBeCloseTo(0, 2);
    expect(capitalRestantDu(credit, new Date('2045-01-01'))).toBe(0);
  });

  it('handles a 0 % rate linearly', () => {
    const credit = makeCredit({ tauxAnnuel: 0, capitalInitial: 24000, dureeMois: 24 });
    // 12 payments made -> half the capital remains
    const crd = capitalRestantDu(credit, new Date('2020-12-01'));
    expect(crd).toBeCloseTo(12000, 6);
  });
});

describe('dateFin', () => {
  it('returns the date of the last due payment', () => {
    const credit = makeCredit({ dateDebut: '2020-01-01', dureeMois: 240 });
    const end = dateFin(credit);
    expect(end.getFullYear()).toBe(2039);
    expect(end.getMonth()).toBe(11); // décembre (240ème mensualité)
  });
});

describe('liberationsParAnnee', () => {
  it('builds the end-of-loan timeline, freeing the monthly payment as credits end', () => {
    const carLoan = makeCredit({
      id: 'car',
      nom: 'Crédit voiture',
      capitalInitial: 20000,
      tauxAnnuel: 2,
      dureeMois: 36,
      dateDebut: '2024-01-01',
    });
    const houseLoan = makeCredit({
      id: 'house',
      nom: 'Crédit Maison',
      capitalInitial: 200000,
      tauxAnnuel: 1.5,
      dureeMois: 240,
      dateDebut: '2020-01-01',
    });
    const today = new Date('2024-06-01');
    const timeline = liberationsParAnnee([carLoan, houseLoan], today);

    const carEndYear = dateFin(carLoan).getFullYear();
    const carEntry = timeline.find((e) => e.annee === carEndYear);
    expect(carEntry).toBeDefined();
    expect(carEntry?.creditsTermines).toEqual(['Crédit voiture']);
    expect(carEntry?.mensualiteLiberee).toBeCloseTo(mensualite(carLoan), 2);

    const houseEndYear = dateFin(houseLoan).getFullYear();
    const houseEntry = timeline.find((e) => e.annee === houseEndYear);
    expect(houseEntry).toBeDefined();
    expect(houseEntry?.creditsTermines).toEqual(['Crédit Maison']);
    // After both loans have ended, nothing remains.
    expect(houseEntry?.mensualiteRestante).toBeCloseTo(0, 2);
  });
});

describe('tauxEndettement', () => {
  it('returns the ratio of total payments to income', () => {
    expect(tauxEndettement(1000, 4000)).toBeCloseTo(0.25, 6);
  });

  it('returns null when income is zero or negative', () => {
    expect(tauxEndettement(1000, 0)).toBeNull();
    expect(tauxEndettement(1000, -500)).toBeNull();
  });
});

describe('couverture', () => {
  it('reports a covered position (assets exceed outstanding balance)', () => {
    const result = couverture(150000, 100000);
    expect(result).not.toBeNull();
    expect(result?.ratio).toBeCloseTo(1.5, 6);
    expect(result?.surplus).toBeCloseTo(50000, 6);
  });

  it('reports an uncovered position (assets below outstanding balance)', () => {
    const result = couverture(40000, 100000);
    expect(result).not.toBeNull();
    expect(result?.ratio).toBeCloseTo(0.4, 6);
    expect(result?.surplus).toBeCloseTo(-60000, 6);
  });

  it('returns null when the outstanding balance is 0', () => {
    expect(couverture(50000, 0)).toBeNull();
  });
});

describe('anneeCouverture', () => {
  it('returns the current year when already covered', () => {
    const credit = makeCredit({
      capitalInitial: 10000,
      tauxAnnuel: 1,
      dureeMois: 60,
      dateDebut: '2020-01-01',
    });
    const today = new Date('2024-01-01');
    expect(anneeCouverture([credit], 1_000_000, today)).toBe(today.getFullYear());
  });

  it('returns a year no later than the loan end when not yet covered', () => {
    const credit = makeCredit({
      capitalInitial: 200000,
      tauxAnnuel: 1.5,
      dureeMois: 240,
      dateDebut: '2020-01-01',
    });
    const today = new Date('2021-01-01');
    const year = anneeCouverture([credit], 50000, today);
    expect(year).toBeGreaterThan(today.getFullYear());
    expect(year).toBeLessThanOrEqual(dateFin(credit).getFullYear());
  });
});

describe('échéances en fin de mois', () => {
  // 1ère échéance le 31 : les mois plus courts tombent sur leur dernier jour.
  const finDeMois = makeCredit({ dateDebut: '2024-01-31', dureeMois: 12 });

  it('dateFin clamps to the last day of a shorter month', () => {
    const credit = makeCredit({ dateDebut: '2024-01-31', dureeMois: 2 });
    const fin = dateFin(credit);
    expect([fin.getFullYear(), fin.getMonth(), fin.getDate()]).toEqual([2024, 1, 29]);
  });

  it('counts the February payment on 29/02, not on 01/03', () => {
    const afterJan = capitalRestantDu(finDeMois, new Date(2024, 0, 31));
    const afterFeb = capitalRestantDu(finDeMois, new Date(2024, 1, 29));
    expect(afterFeb).toBeLessThan(afterJan);
  });

  it('counts the April payment on 30/04', () => {
    const afterMar = capitalRestantDu(finDeMois, new Date(2024, 2, 31));
    const afterApr = capitalRestantDu(finDeMois, new Date(2024, 3, 30));
    expect(afterApr).toBeLessThan(afterMar);
  });
});

describe('mensualitesEnCours', () => {
  it('sums payment + insurance of running loans only', () => {
    const today = new Date(2026, 5, 15);
    const enCours = makeCredit({
      tauxAnnuel: 0,
      capitalInitial: 24000,
      dureeMois: 240,
      assuranceMensuelle: 20,
    });
    const termine = makeCredit({ id: 'c2', dateDebut: '2010-01-01', dureeMois: 12 });
    expect(mensualitesEnCours([enCours, termine], today)).toBeCloseTo(100 + 20, 6);
  });
});
