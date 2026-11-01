import { describe, it, expect } from 'vitest';
import { parseCalendarDate, toCalendarKey } from '../date';

/**
 * Ces tests doivent passer sous n'importe quel fuseau :
 *   TZ=Europe/Paris npx vitest run …   et   TZ=America/New_York npx vitest run …
 */
describe('parseCalendarDate', () => {
  it('lit YYYY-MM-DD comme minuit LOCAL (pas UTC)', () => {
    const d = parseCalendarDate('2026-10-31');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(0);
  });

  it.each(['2026-03-29', '2026-10-25', '2026-03-08', '2026-11-01'])(
    'conserve le jour pour la date de bascule DST %s',
    (key) => {
      expect(toCalendarKey(parseCalendarDate(key))).toBe(key);
    },
  );

  it('accepte le 29 février d’une année bissextile', () => {
    expect(toCalendarKey(parseCalendarDate('2028-02-29'))).toBe('2028-02-29');
  });

  it('refuse une date calendaire inexistante (pas de débordement silencieux)', () => {
    expect(Number.isNaN(parseCalendarDate('2026-02-31').getTime())).toBe(true);
    expect(Number.isNaN(parseCalendarDate('2026-13-01').getTime())).toBe(true);
  });

  it('retourne Invalid Date pour une chaîne illisible', () => {
    expect(Number.isNaN(parseCalendarDate('').getTime())).toBe(true);
    expect(Number.isNaN(parseCalendarDate('pas une date').getTime())).toBe(true);
  });

  it('laisse un horodatage ISO complet inchangé (même instant que new Date)', () => {
    const iso = '2026-10-31T23:30:00.000Z';
    expect(parseCalendarDate(iso).getTime()).toBe(new Date(iso).getTime());
    const withOffset = '2026-10-31T23:30:00+01:00';
    expect(parseCalendarDate(withOffset).getTime()).toBe(new Date(withOffset).getTime());
  });
});

describe('toCalendarKey', () => {
  it('formate les composantes locales (jamais toISOString)', () => {
    expect(toCalendarKey(new Date(2026, 9, 31, 0, 30))).toBe('2026-10-31');
    expect(toCalendarKey(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
    expect(toCalendarKey(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
  });

  it('complète mois et jour sur deux chiffres', () => {
    expect(toCalendarKey(new Date(2026, 0, 4))).toBe('2026-01-04');
  });
});
