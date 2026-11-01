import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import {
  getPeriodBounds,
  calculateRythmeTheorique,
  computeConsumption,
} from '../../api/consumption';
import { getMonthRange } from '../../components/shared/MonthNavigator';
import {
  computePeriodState,
  getExpectedDate,
  getUpcomingOccurrences,
  getDayOfMonth,
} from '../recurrenceEngine';
import { computeDerivedRav, getRecurringProvisions } from '../ravCalculations';
import type { Recurrence } from '../../types/banking.types';
import type { RavConfigFormValues } from '../../lib/schemas/forms';

/**
 * Régression « dérive de fuseau » : à exécuter sous au moins deux TZ
 *   TZ=Europe/Paris npx vitest run <fichier>
 *   TZ=America/New_York npx vitest run <fichier>
 * Les attendus sont indépendants du fuseau : une date calendaire reste la même
 * quel que soit l'endroit où l'on la lit.
 */

const budgetMois = { montant: 310, periode: { type: 'mois_courant' } };
const bounds = (referenceDate: Date | string) => {
  const { debut, fin } = getPeriodBounds(budgetMois, referenceDate);
  return `${debut}→${fin}`;
};

describe('bornes de la période « mois courant »', () => {
  it.each([
    ['2026-10-31', '2026-10-01→2026-10-31'],
    ['2026-11-01', '2026-11-01→2026-11-30'],
    ['2026-03-29', '2026-03-01→2026-03-31'], // bascule DST Paris
    ['2026-10-25', '2026-10-01→2026-10-31'], // bascule DST Paris
    ['2026-11-30', '2026-11-01→2026-11-30'], // mois de 30 jours
    ['2026-02-28', '2026-02-01→2026-02-28'],
    ['2028-02-29', '2028-02-01→2028-02-29'], // bissextile
    ['2026-01-31', '2026-01-01→2026-01-31'],
  ])('référence chaîne %s → %s', (ref, expected) => {
    expect(bounds(ref)).toBe(expected);
  });

  it('référence Date locale (minuit et fin de journée) → même mois', () => {
    expect(bounds(new Date(2026, 9, 31, 0, 0))).toBe('2026-10-01→2026-10-31');
    expect(bounds(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-01→2026-10-31');
    expect(bounds(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01→2026-11-30');
  });

  it('getMonthRange (navigateur de mois) concorde avec le moteur de consommation', () => {
    for (const month of [
      new Date(2026, 9, 1),
      new Date(2026, 10, 1),
      new Date(2026, 1, 1),
      new Date(2028, 1, 1),
    ]) {
      const { start, end } = getMonthRange(month);
      expect(`${start}→${end}`).toBe(bounds(month));
    }
    expect(getMonthRange(new Date(2026, 9, 1))).toEqual({
      start: '2026-10-01',
      end: '2026-10-31',
    });
  });
});

describe('autres périodes de consommation', () => {
  it('période custom : bornes calendaires inchangées', () => {
    const b = getPeriodBounds(
      { montant: 100, periode: { type: 'custom', debut: '2026-10-01', fin: '2026-10-31' } },
      '2026-10-15',
    );
    expect(b).toEqual({ debut: '2026-10-01', fin: '2026-10-31' });
  });

  it('année glissante depuis une date chaîne', () => {
    const b = getPeriodBounds({ montant: 100, periode: { type: 'annee_glissante' } }, '2026-03-01');
    expect(b).toEqual({ debut: '2025-03-01', fin: '2026-03-01' });
  });

  it('année civile depuis une date chaîne au 1er janvier', () => {
    const b = getPeriodBounds({ montant: 100, periode: { type: 'annee_civile' } }, '2026-01-01');
    expect(b).toEqual({ debut: '2026-01-01', fin: '2026-12-31' });
  });
});

describe('rythme théorique (jours écoulés)', () => {
  // 16 octobre sur un mois de 31 jours → 16/31 du budget, à n'importe quelle heure.
  it.each([
    ['minuit', new Date(2026, 9, 16, 0, 0)],
    ['midi', new Date(2026, 9, 16, 12, 0)],
    ['15h', new Date(2026, 9, 16, 15, 0)],
    ['23h30', new Date(2026, 9, 16, 23, 30)],
  ])('Date locale à %s', (_label, ref) => {
    expect(calculateRythmeTheorique(budgetMois, ref, '2026-10-01', '2026-10-31')).toBeCloseTo(
      (310 * 16) / 31,
      6,
    );
  });

  it('référence chaîne', () => {
    expect(
      calculateRythmeTheorique(budgetMois, '2026-10-16', '2026-10-01', '2026-10-31'),
    ).toBeCloseTo((310 * 16) / 31, 6);
  });

  it('computeConsumption : le 16 à 15h, rythme = 16/31', () => {
    const r = computeConsumption(
      { ...budgetMois, categorie: 'Loisirs' },
      [],
      new Date(2026, 9, 16, 15, 0),
    );
    expect(r.rythmeTheorique).toBeCloseTo(160, 2);
    expect(r.periodeDebut).toBe('2026-10-01');
    expect(r.periodeFin).toBe('2026-10-31');
  });
});

describe('mois courant déduit de « maintenant » (mirroir toISOString)', () => {
  const loyer = {
    id: 'r1',
    label: 'Loyer',
    category: 'Logement',
    expectedAmount: -500,
    anchorDate: '2026-10-28',
    active: true,
  } as unknown as Recurrence;

  it('le 1er novembre à 00h30 locales, octobre est un mois passé (provision nulle)', () => {
    const now = new Date(2026, 10, 1, 0, 30);
    const total = getRecurringProvisions('2026-10', [], [loyer], 'expense', {
      referenceDate: now,
      checkPastMonth: true,
    });
    expect(total).toBe(0);
  });

  it('le 31 octobre à 23h30 locales, octobre est le mois courant (provision conservée)', () => {
    const now = new Date(2026, 9, 31, 23, 30);
    const total = getRecurringProvisions('2026-10', [], [loyer], 'expense', {
      referenceDate: now,
      checkPastMonth: true,
    });
    expect(total).toBe(-500);
  });

  const cfg = {
    revenu_mensuel_net: null,
    provision_salaires: {},
    revenu_categories: [],
    depense_categories: [],
    included_accounts: [],
  } as RavConfigFormValues;
  const provisionEnveloppe = (referenceDate: Date) =>
    computeDerivedRav(cfg, {
      monthKey: '2026-10',
      txList: [],
      recurrences: [],
      envelopeProvision: 100,
      referenceDate,
    }).provisions;

  it('computeDerivedRav : la provision d’enveloppe s’arrête le 1er novembre à 00h30', () => {
    expect(provisionEnveloppe(new Date(2026, 10, 1, 0, 30))).toBe(0);
  });

  it('computeDerivedRav : la provision d’enveloppe court encore le 31 octobre à 23h30', () => {
    expect(provisionEnveloppe(new Date(2026, 9, 31, 23, 30))).toBe(-100);
  });
});

describe('échéances de récurrences', () => {
  const rec = (anchorDate: string, extra: Partial<Recurrence> = {}) =>
    ({
      id: 'r',
      label: 'Abonnement',
      category: 'Loisirs',
      expectedAmount: -10,
      active: true,
      anchorDate,
      createdAt: { seconds: 0, nanoseconds: 0 } as unknown as Timestamp,
      ...extra,
    }) as Recurrence;

  it('une récurrence ancrée le 4 reste le 4, mois après mois', () => {
    const r = rec('2026-01-04');
    expect(getDayOfMonth(r)).toBe(4);
    for (let m = 1; m <= 12; m++) {
      const key = `2026-${String(m).padStart(2, '0')}`;
      expect(getExpectedDate(r, key)).toBe(`${key}-04`);
    }
  });

  it('ancrage le 31 : clampé à la fin du mois (février, mois de 30 jours)', () => {
    const r = rec('2026-01-31');
    expect(getExpectedDate(r, '2026-02')).toBe('2026-02-28');
    expect(getExpectedDate(r, '2028-02')).toBe('2028-02-29');
    expect(getExpectedDate(r, '2026-04')).toBe('2026-04-30');
    expect(getExpectedDate(r, '2026-10')).toBe('2026-10-31');
  });

  it('ancrage tardif (28–31) : prochaines échéances à cheval sur la fin de mois', () => {
    const from = new Date(2026, 9, 25); // 25/10/2026, jour du passage à l'heure d'hiver
    const dates = (day: number) =>
      getUpcomingOccurrences(rec(`2026-01-${day}`), from, 40).map((o) => o.date);
    expect(dates(28)).toEqual(['2026-10-28', '2026-11-28']);
    expect(dates(31)).toEqual(['2026-10-31', '2026-11-30']);
    expect(dates(30)).toEqual(['2026-10-30', '2026-11-30']);
  });

  it('prochaines échéances à travers la bascule DST du 29/03/2026', () => {
    const from = new Date(2026, 2, 27);
    const dates = getUpcomingOccurrences(rec('2026-01-04'), from, 14).map((o) => o.date);
    expect(dates).toEqual(['2026-04-04']);
    const jour29 = getUpcomingOccurrences(rec('2026-01-29'), from, 14).map((o) => o.date);
    expect(jour29).toEqual(['2026-03-29']);
  });

  it('fenêtre incluant le 1er du mois suivant', () => {
    const from = new Date(2026, 9, 31);
    const dates = getUpcomingOccurrences(rec('2026-01-01'), from, 1).map((o) => o.date);
    expect(dates).toEqual(['2026-11-01']);
  });

  it.each([
    // [échéance, aujourd'hui (local), état attendu]
    ['2026-10-04', new Date(2026, 9, 3, 12), 'expected'],
    ['2026-10-04', new Date(2026, 9, 4, 0, 0), 'expected'], // le jour même : pas en retard
    ['2026-10-04', new Date(2026, 9, 4, 23, 59), 'expected'],
    ['2026-10-04', new Date(2026, 9, 5, 0, 0), 'overdue'], // lendemain : en retard
    ['2026-10-25', new Date(2026, 9, 25, 12), 'expected'], // DST
    ['2026-10-25', new Date(2026, 9, 26, 0, 0), 'overdue'],
    ['2026-03-29', new Date(2026, 2, 29, 12), 'expected'], // DST
    ['2026-03-29', new Date(2026, 2, 30, 0, 0), 'overdue'],
  ] as const)('échéance %s vue le %s → %s', (expectedDate, today, state) => {
    const r = rec(expectedDate);
    const periodKey = expectedDate.slice(0, 7);
    expect(computePeriodState(r, periodKey, [], today).state).toBe(state);
  });
});
