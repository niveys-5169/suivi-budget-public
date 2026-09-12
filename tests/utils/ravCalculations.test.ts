import { describe, it, expect } from 'vitest';
import {
  normCategory,
  categoryMatcher,
  getRecurringProvisions,
  computeDerivedRav,
  DEFAULT_EXCLUDED_EXPENSES,
} from '../../public/src/utils/ravCalculations';
import type { Transaction, Recurrence } from '../../public/src/types/banking.types';
import type { RavConfigFormValues } from '../../public/src/lib/schemas/forms';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    montant: 0,
    date: '2024-03-10',
    pointe: true,
    ...over,
  }) as Transaction;

const baseConfig: RavConfigFormValues = {
  revenu_mensuel_net: null,
  provision_salaires: {},
  revenu_categories: [],
  depense_categories: [],
  included_accounts: [],
};

describe('normCategory', () => {
  it('trims and lowercases (French locale)', () => {
    expect(normCategory('  Épicerie  ')).toBe('épicerie');
  });

  it('returns empty string for nullish input', () => {
    expect(normCategory('')).toBe('');
    expect(normCategory(undefined as unknown as string)).toBe('');
  });
});

describe('categoryMatcher', () => {
  it('matches only selected categories when a selection exists (case-insensitive)', () => {
    const match = categoryMatcher(['Loyer', 'Courses'], DEFAULT_EXCLUDED_EXPENSES);
    expect(match('loyer')).toBe(true);
    expect(match('COURSES')).toBe(true);
    expect(match('Restaurant')).toBe(false);
  });

  it('falls back to excluding defaults when no selection', () => {
    const match = categoryMatcher([], DEFAULT_EXCLUDED_EXPENSES);
    expect(match('Restaurant')).toBe(true);
    expect(match('Épargne')).toBe(false);
    expect(match('Virement interne')).toBe(false);
  });

  it('ignores blank entries in the selection', () => {
    const match = categoryMatcher(['', '   '], DEFAULT_EXCLUDED_EXPENSES);
    // empty selection → default-excluded behaviour
    expect(match('Restaurant')).toBe(true);
    expect(match('Épargne')).toBe(false);
  });
});

describe('getRecurringProvisions', () => {
  const recurrence = (over: Partial<Recurrence>): Recurrence =>
    ({
      id: 'r1',
      label: 'Netflix',
      category: 'Loisirs',
      expectedAmount: -50,
      dayOfMonth: 15,
      active: true,
      ...over,
    }) as Recurrence;

  it('sums active monthly expense provisions not already matched by a transaction', () => {
    const recurrences = [recurrence({ expectedAmount: -50 })];
    const total = getRecurringProvisions('2024-03', [], recurrences, 'expense');
    expect(total).toBe(-50);
  });

  it('skips a provision already matched by a pointed transaction (category + amount + day)', () => {
    const recurrences = [recurrence({ expectedAmount: -50, category: 'Loisirs', dayOfMonth: 15 })];
    const txs = [tx({ montant: -50, categorie: 'Loisirs', date: '2024-03-15' })];
    const total = getRecurringProvisions('2024-03', txs, recurrences, 'expense');
    expect(total).toBe(0);
  });

  it('ignores inactive recurrences', () => {
    const recurrences = [
      recurrence({ id: 'inactive', expectedAmount: -50, active: false }),
      recurrence({ id: 'active', expectedAmount: -75 }),
    ];
    expect(getRecurringProvisions('2024-03', [], recurrences, 'expense')).toBe(-75);
  });

  it('handles income movement type (positive amounts)', () => {
    const recurrences = [recurrence({ id: 'salaire', category: 'Revenus', expectedAmount: 1200 })];
    expect(getRecurringProvisions('2024-03', [], recurrences, 'income')).toBe(1200);
  });
});

describe('computeDerivedRav', () => {
  const ctx = (txList: Transaction[], recurrences: Recurrence[] = []) => ({
    monthKey: '2024-03',
    txList,
    recurrences,
  });

  it('returns zeros for an empty config and no data', () => {
    const r = computeDerivedRav(baseConfig, ctx([]));
    expect(r).toEqual({
      reste: 0,
      revenuRef: 0,
      totalDep: 0,
      provisions: 0,
      modeLabel: 'FIXE',
      pct: 0,
    });
  });

  it('computes reste = revenus déclarés - dépenses pointées du mois', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 2000, categorie: 'Salaire Nico' } },
    };
    const txs = [
      tx({ montant: -300, categorie: 'Courses', date: '2024-03-05' }),
      tx({ montant: -200, categorie: 'Loyer', date: '2024-03-01' }),
      tx({ montant: -999, categorie: 'Courses', date: '2024-02-15' }), // autre mois → ignoré
    ];
    const r = computeDerivedRav(config, ctx(txs));
    expect(r.revenuRef).toBe(2000);
    expect(r.totalDep).toBe(-500);
    expect(r.reste).toBe(1500);
    expect(r.pct).toBeCloseTo(75);
  });

  it('excludes non-pointed transactions and respects included_accounts', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 1000, categorie: 'Salaire Nico' } },
      included_accounts: ['CCP'],
    };
    const txs = [
      tx({ montant: -100, categorie: 'Courses', compte: 'CCP' }),
      tx({ montant: -100, categorie: 'Courses', compte: 'CCP', pointe: false }), // non pointé
      tx({ montant: -100, categorie: 'Courses', compte: 'Autre' }), // hors comptes inclus
    ];
    const r = computeDerivedRav(config, ctx(txs));
    expect(r.totalDep).toBe(-100);
    expect(r.reste).toBe(900);
  });

  it('clamps pct between 0 and 100', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 1000, categorie: 'Salaire Nico' } },
    };
    const txs = [tx({ montant: -5000, categorie: 'Courses' })];
    const r = computeDerivedRav(config, ctx(txs));
    expect(r.reste).toBe(-4000);
    expect(r.pct).toBe(0);
  });

  it('subtracts a pending recurring expense provision from reste (not adds it)', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 2000, categorie: 'Salaire Nico' } },
    };
    const recurrences: Recurrence[] = [
      {
        id: 'netflix',
        label: 'Netflix',
        category: 'Abonnements',
        expectedAmount: -50,
        dayOfMonth: 15,
        active: true,
      } as Recurrence,
    ];
    const r = computeDerivedRav(config, ctx([], recurrences));
    expect(r.provisions).toBe(-50);
    // 2000 - 0 + (-50) = 1950. Un signe inversé donnerait 2050 (provision qui
    // augmenterait le reste au lieu de le diminuer).
    expect(r.reste).toBe(1950);
  });
});
