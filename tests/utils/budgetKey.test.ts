import { describe, it, expect } from 'vitest';
import { budgetDocKey } from '../../public/src/utils/budgetKey';

describe('budgetDocKey', () => {
  it('returns the category name unchanged when it contains no slash', () => {
    expect(budgetDocKey('Nourriture')).toBe('Nourriture');
  });

  it('encodes categories containing a slash with __enc__ prefix', () => {
    expect(budgetDocKey('Vacances/Été')).toBe(`__enc__${encodeURIComponent('Vacances/Été')}`);
  });

  it('encodes a plain slash', () => {
    expect(budgetDocKey('A/B')).toBe(`__enc__${encodeURIComponent('A/B')}`);
  });

  it('returns empty string for falsy input', () => {
    expect(budgetDocKey('')).toBe('');
  });

  it('coerces non-string input to string', () => {
    // @ts-expect-error — testing runtime coercion
    expect(budgetDocKey(null)).toBe('');
  });

  it('is stable — same input always yields the same key', () => {
    const key = budgetDocKey('Crédit Maison');
    expect(budgetDocKey('Crédit Maison')).toBe(key);
  });
});
