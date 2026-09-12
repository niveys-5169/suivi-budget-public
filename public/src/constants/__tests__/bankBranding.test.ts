import { describe, it, expect } from 'vitest';
import { getBankBranding } from '../bankBranding';
import { getSyncSourceLabel } from '../syncSource';

describe('getBankBranding', () => {
  it('matches a known bank by substring, case-insensitive', () => {
    expect(getBankBranding('BforBank Compte Courant')).toEqual({ short: 'BFB', color: '#E4002B' });
    expect(getBankBranding('lcl compte joint').short).toBe('LCL');
  });

  it('falls back to gold with initials for unknown banks', () => {
    const b = getBankBranding('Banque Inconnue');
    expect(b.color).toBe('#D4AF37');
    expect(b.short).toBe('BA');
  });

  it('handles empty names without throwing', () => {
    expect(getBankBranding('').short).toBe('?');
  });
});

describe('getSyncSourceLabel', () => {
  it('maps known sources to readable labels', () => {
    expect(getSyncSourceLabel('gmail')).toBe('Linxo');
    expect(getSyncSourceLabel('manual')).toBe('Manuel');
  });

  it('returns empty string for missing source', () => {
    expect(getSyncSourceLabel(undefined)).toBe('');
  });

  it('passes through unknown sources', () => {
    expect(getSyncSourceLabel('mystery')).toBe('mystery');
  });
});
