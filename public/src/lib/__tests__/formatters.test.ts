import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatCompactCurrency, formatDecimal } from '../formatters';
import { fmt } from '../../utils/format';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('formats positive currency amounts correctly', () => {
      const result = formatCurrency(1234.56, 'EUR', 'fr-FR');
      // Use helper to normalize spaces (like non-breaking spaces used by Intl.NumberFormat)
      const cleanResult = result.replace(/\u202f|\u00a0/g, ' ');
      expect(cleanResult).toBe('1 234,56 €');
    });

    it('formats negative currency amounts correctly', () => {
      const result = formatCurrency(-1234.56, 'EUR', 'fr-FR');
      const cleanResult = result.replace(/\u202f|\u00a0/g, ' ');
      expect(cleanResult).toBe('-1 234,56 €');
    });

    it('formats other currencies and locales correctly', () => {
      const result = formatCurrency(100, 'USD', 'en-US');
      const cleanResult = result.replace(/\u202f|\u00a0/g, ' ');
      expect(cleanResult).toBe('$100.00');
    });

    it('supports custom formatting options and caches the formatter', () => {
      const val = 1234.567;
      const resCompact = formatCurrency(val, 'EUR', 'fr-FR', { notation: 'compact' });
      expect(resCompact).toBeDefined();

      const resNoDecimals = formatCurrency(val, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });
      expect(resNoDecimals.replace(/\u202f|\u00a0/g, ' ')).toMatch(/1 235 €/);
    });
  });

  // Les chaînes ci-dessous sont EXACTES : U+00A0 (espace insécable) entre le nombre et « % » / « € » / « k ».
  describe('formatPercent (entrée en points de pourcentage : 8.3 → « 8,3 % »)', () => {
    it('utilise la virgule décimale et l’espace insécable avant %', () => {
      expect(formatPercent(8.3)).toBe('8,3\u00a0%');
    });

    it('respecte le nombre de décimales demandé (fixe, comme toFixed)', () => {
      expect(formatPercent(8.3, { decimals: 0 })).toBe('8\u00a0%');
      expect(formatPercent(8, { decimals: 2 })).toBe('8,00\u00a0%');
      expect(formatPercent(12.345, { decimals: 1 })).toBe('12,3\u00a0%');
    });

    it('ne met pas de signe + par défaut, garde le signe moins', () => {
      expect(formatPercent(4.25, { decimals: 2 })).toBe('4,25\u00a0%');
      expect(formatPercent(-3.5)).toBe('-3,5\u00a0%');
    });

    it('n\u2019affiche pas \u00ab -0 \u00bb pour un z\u00e9ro n\u00e9gatif (0 / base n\u00e9gative)', () => {
      expect(formatPercent(-0)).toBe('0,0\u00a0%');
    });

    it('affiche + devant les valeurs positives avec signed, mais pas devant zéro', () => {
      expect(formatPercent(4.25, { decimals: 2, signed: true })).toBe('+4,25\u00a0%');
      expect(formatPercent(-1.5, { decimals: 2, signed: true })).toBe('-1,50\u00a0%');
      expect(formatPercent(0, { signed: true })).toBe('0,0\u00a0%');
    });

    it('gère les centaines', () => {
      expect(formatPercent(100, { decimals: 0 })).toBe('100\u00a0%');
    });
  });

  describe('formatCompactCurrency (graduations d’axes)', () => {
    it('ne compacte pas sous 1 000', () => {
      expect(formatCompactCurrency(0)).toBe('0\u00a0€');
      expect(formatCompactCurrency(500)).toBe('500\u00a0€');
    });

    it('compacte les milliers en « k € »', () => {
      expect(formatCompactCurrency(1234)).toBe('1,2\u00a0k\u00a0€');
      expect(formatCompactCurrency(45000)).toBe('45\u00a0k\u00a0€');
      expect(formatCompactCurrency(-45000)).toBe('-45\u00a0k\u00a0€');
    });

    it('compacte les millions en « M € »', () => {
      expect(formatCompactCurrency(1500000)).toBe('1,5\u00a0M\u00a0€');
      expect(formatCompactCurrency(-2500000)).toBe('-2,5\u00a0M\u00a0€');
    });
  });

  describe('formatDecimal', () => {
    it('utilise la virgule décimale et un nombre fixe de décimales', () => {
      expect(formatDecimal(1.5, 1)).toBe('1,5');
      expect(formatDecimal(0.9557, 4)).toBe('0,9557');
      expect(formatDecimal(0.9, 2)).toBe('0,90');
    });

    it('sépare les milliers par une espace fine insécable (U+202F)', () => {
      expect(formatDecimal(1234.5, 2)).toBe('1\u202f234,50');
    });
  });

  describe('fmt', () => {
    it('formats numbers correctly as EUR', () => {
      const result = fmt(1234.56);
      const cleanResult = result.replace(/\u202f|\u00a0/g, ' ');
      expect(cleanResult).toBe('1 234,56 €');
    });

    it('formats numeric strings correctly as EUR', () => {
      const result = fmt('1234.56');
      const cleanResult = result.replace(/\u202f|\u00a0/g, ' ');
      expect(cleanResult).toBe('1 234,56 €');
    });

    it('returns "—" for invalid values', () => {
      expect(fmt('invalid')).toBe('—');
      expect(fmt(NaN)).toBe('—');
    });
  });
});
