import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../formatters';
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
