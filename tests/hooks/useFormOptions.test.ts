import { describe, it, expect } from 'vitest';
import { deriveCategoryOptions, deriveAccountOptions } from '../../public/src/hooks/useFormOptions';
import type { Transaction } from '../../public/src/types/banking.types';

const tx = (categorie?: string): Transaction => ({ categorie }) as Transaction;

describe('deriveCategoryOptions', () => {
  it('merges budget candidates with transaction categories, unique and sorted', () => {
    const out = deriveCategoryOptions(
      ['Loyer', 'Courses'],
      [tx('Courses'), tx('Salaire'), tx('Loyer')],
    );
    expect(out).toEqual(['Courses', 'Loyer', 'Salaire']);
  });

  it('drops empty/undefined transaction categories', () => {
    expect(deriveCategoryOptions([], [tx(''), tx(undefined), tx('Santé')])).toEqual(['Santé']);
  });

  it('returns candidates alone when there are no transactions', () => {
    expect(deriveCategoryOptions(['B', 'A'], [])).toEqual(['A', 'B']);
  });
});

describe('deriveAccountOptions', () => {
  it('returns distinct non-empty account names, sorted, plus the Liquide virtual account', () => {
    expect(
      deriveAccountOptions([
        { compte: 'LCL' },
        { compte: 'Boursorama' },
        { compte: 'LCL' },
        { compte: '' },
        { compte: null },
      ]),
    ).toEqual(['Boursorama', 'LCL', 'Liquide']);
  });

  it('returns only the Liquide virtual account when there are no balances', () => {
    expect(deriveAccountOptions([])).toEqual(['Liquide']);
  });
});
