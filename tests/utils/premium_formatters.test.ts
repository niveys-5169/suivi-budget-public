import { describe, it, expect } from 'vitest';
import { formatCurrency, formatMaskedIban, formatPercent } from '../../public/src/lib/formatters';

describe('Premium Banking Formatters', () => {
  describe('formatCurrency', () => {
    it('should format EUR amounts correctly for fr-FR locale', () => {
      const result = formatCurrency(1250.5, 'EUR');
      // On utilise une regex pour gérer les espaces insécables que Intl.NumberFormat peut insérer
      expect(result).toMatch(/1\s?250,50\s?€/);
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(-45.0, 'EUR');
      expect(result).toMatch(/-45,00\s?€/);
    });

    it('should handle different currencies like USD', () => {
      const result = formatCurrency(100, 'USD', 'en-US');
      expect(result).toBe('$100.00');
    });
  });

  describe('formatMaskedIban', () => {
    it('should mask all but the last 4 characters of an IBAN', () => {
      const iban = 'FR76 3000 6000 0001 2345 6789 012';
      expect(formatMaskedIban(iban)).toBe('•••• 9012');
    });

    it('should handle IBANs without spaces', () => {
      const iban = 'FR7630006000000123456789012';
      expect(formatMaskedIban(iban)).toBe('•••• 9012');
    });
  });

  describe('formatPercent', () => {
    it('should add a plus sign for positive percentages', () => {
      expect(formatPercent(4.25)).toBe('+4,25%');
    });

    it('should keep the minus sign for negative percentages', () => {
      expect(formatPercent(-1.5)).toBe('-1,50%');
    });

    it('should format zero correctly', () => {
      expect(formatPercent(0)).toBe('+0,00%');
    });
  });
});
