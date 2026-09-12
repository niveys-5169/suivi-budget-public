import { describe, it, expect } from 'vitest';
import {
  normalizeSearchValue,
  buildAmountSearchValues,
} from '../../public/src/utils/searchHelpers';

describe('normalizeSearchValue', () => {
  it('lowercases', () => {
    expect(normalizeSearchValue('Hello WORLD')).toBe('hello world');
  });

  it('strips diacritics', () => {
    expect(normalizeSearchValue('Café crème')).toBe('cafe creme');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeSearchValue('a   b\t c')).toBe('a b c');
  });

  it('trims edges', () => {
    expect(normalizeSearchValue('  hello  ')).toBe('hello');
  });

  it('returns empty string for falsy input', () => {
    expect(normalizeSearchValue('')).toBe('');
    expect(normalizeSearchValue(undefined as unknown as string)).toBe('');
    expect(normalizeSearchValue(null as unknown as string)).toBe('');
  });

  it('handles mixed accents + case + whitespace', () => {
    expect(normalizeSearchValue('  Épargne   PLACEMENT  ')).toBe('epargne placement');
  });
});

describe('buildAmountSearchValues', () => {
  it('returns variants for a negative amount', () => {
    const values = buildAmountSearchValues(-29.99);
    // Includes signed + unsigned, dot + comma decimals.
    expect(values).toEqual(expect.arrayContaining(['-29.99', '-29,99', '29.99', '29,99']));
  });

  it('returns variants for a positive amount', () => {
    const values = buildAmountSearchValues(1500);
    expect(values).toEqual(expect.arrayContaining(['1500.00', '1500,00', '1500']));
  });

  it('matches a fr-FR formatted currency query (with and without €/spaces)', () => {
    const values = buildAmountSearchValues(-29.99);
    // The fr-FR formatter outputs e.g. "-29,99 €" — normalised stripping the
    // currency symbol must surface in the variant set.
    expect(values.some((v) => v.includes('-29,99'))).toBe(true);
    expect(values.some((v) => v.includes('29,99'))).toBe(true);
  });

  it('returns [] for non-finite amounts', () => {
    expect(buildAmountSearchValues(Number.NaN)).toEqual([]);
    expect(buildAmountSearchValues(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(buildAmountSearchValues('not a number')).toEqual([]);
  });

  it('returns [] for null/undefined', () => {
    expect(buildAmountSearchValues(null)).toEqual([]);
    expect(buildAmountSearchValues(undefined)).toEqual([]);
  });

  it('all variants are normalised (lowercase, no diacritics)', () => {
    const values = buildAmountSearchValues(1234.56);
    values.forEach((v) => {
      expect(v).toBe(v.toLowerCase());
    });
  });
});
