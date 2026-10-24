import { describe, it, expect } from 'vitest';
import {
  normCategory,
  categoryMatcher,
  getRecurringProvisions,
  computeDerivedRav,
  computeReferenceIncome,
  isAllowedIncomeCategory,
  isSalaryOrCafCategory,
  matchesIncomeCategory,
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

  it('one pending bank payment settles only one of two recurring bills', () => {
    const recurrences = [
      recurrence({ id: 'first', label: 'CAFE', expectedAmount: -50 }),
      recurrence({ id: 'second', label: 'CAFE', expectedAmount: -50 }),
    ];
    const transactions = [
      tx({
        id: 'pending',
        libelle: 'CAFE',
        categorie: 'Loisirs',
        montant: -50,
        date: '2024-03-15',
        pointe: false,
        bankStatus: 'pending',
        source: 'enable_banking',
      }),
    ];
    expect(getRecurringProvisions('2024-03', transactions, recurrences, 'expense')).toBe(-50);
  });

  it('provisions again after an explicitly cancelled linked approval, keeping its trace', () => {
    const approvedMonths = {
      '2024-03': {
        txId: 'cancelled',
        amount: -500,
        date: '2024-03-15',
        approvedAt: 1,
        bankCancelled: true,
      },
    };
    const rec = recurrence({ expectedAmount: -500, approvedMonths });
    expect(getRecurringProvisions('2024-03', [], [rec], 'expense')).toBe(-500);
    expect(rec.approvedMonths?.['2024-03']?.txId).toBe('cancelled');
  });

  it('handles income movement type (positive amounts)', () => {
    const recurrences = [recurrence({ id: 'salaire', category: 'Revenus', expectedAmount: 1200 })];
    expect(getRecurringProvisions('2024-03', [], recurrences, 'income')).toBe(1200);
  });
});

describe('computeDerivedRav', () => {
  const ctx = (txList: Transaction[], recurrences: Recurrence[] = [], referenceDate?: Date) => ({
    monthKey: '2024-03',
    txList,
    recurrences,
    referenceDate: referenceDate ?? new Date('2024-03-15'),
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

  it('dédoublonne les salaires saisis et les récurrences pour éviter d’atteindre 11 000 €', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      revenu_categories: ['Salaire Gwen', 'Salaire Nico', 'CAF'],
      provision_salaires: {
        nico: { montant: 2650, categorie: 'Salaire Nico' },
        gwen: { montant: 2355, categorie: 'Salaire Gwen' },
      },
    };
    const recurrences: Recurrence[] = [
      // Récurrence du salaire Nico déjà provisionné -> NE DOIT PAS ÊTRE AJOUTÉE
      {
        id: 'rec-sal-nico',
        label: 'Virement Salaire Nico',
        category: 'Salaire Nico',
        expectedAmount: 2650,
        active: true,
      } as Recurrence,
      // Récurrence du salaire Gwen déjà provisionné -> NE DOIT PAS ÊTRE AJOUTÉE
      {
        id: 'rec-sal-gwen',
        label: 'Virement Salaire Gwen',
        category: 'Salaire Gwen',
        expectedAmount: 2355,
        active: true,
      } as Recurrence,
      // Récurrence CAF (non provisionnée manuellement) -> DOIT ÊTRE AJOUTÉE
      {
        id: 'rec-caf',
        label: 'Allocations CAF',
        category: 'CAF',
        expectedAmount: 750,
        active: true,
      } as Recurrence,
      // Virement compte à compte ou épargne -> NE DOIT PAS ÊTRE AJOUTÉ
      {
        id: 'rec-virement-interne',
        label: 'Virement Livret A vers Courant',
        category: 'Virements internes',
        expectedAmount: 5000,
        active: true,
      } as Recurrence,
    ];

    const r = computeDerivedRav(config, ctx([], recurrences));
    // Revenu attendu = 2650 (Nico) + 2355 (Gwen) + 750 (CAF) = 5755 €
    // (et JAMAIS ~11 000 € ou 16 000 € avec le virement interne !)
    expect(r.revenuRef).toBe(5755);
    expect(r.reste).toBe(5755);
  });

  it('utilise les récurrences de salaires si aucune provision manuelle n’est renseignée', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      revenu_categories: ['Salaire Gwen', 'Salaire Nico', 'CAF'],
      provision_salaires: {},
    };
    const recurrences: Recurrence[] = [
      {
        id: 'rec-sal-nico',
        label: 'Salaire Nico',
        category: 'Salaire Nico',
        expectedAmount: 2650,
        active: true,
      } as Recurrence,
      {
        id: 'rec-caf',
        label: 'CAF',
        category: 'CAF',
        expectedAmount: 750,
        active: true,
      } as Recurrence,
    ];
    const r = computeDerivedRav(config, ctx([], recurrences));
    expect(r.revenuRef).toBe(3400);
  });
});

describe('computeReferenceIncome', () => {
  it('filtre strictement sur les catégories de revenus autorisées', () => {
    const cfg = {
      revenu_categories: ['Salaire Nico', 'CAF'],
      provision_salaires: {
        nico: { montant: 2500, categorie: 'Salaire Nico' },
        hors_perimetre: { montant: 1000, categorie: 'Autre revenu non validé' },
      },
    };
    const recurrences: Recurrence[] = [
      { id: '1', label: 'CAF', category: 'CAF', expectedAmount: 400, active: true } as Recurrence,
      {
        id: '2',
        label: 'Vente leboncoin',
        category: 'Divers',
        expectedAmount: 300,
        active: true,
      } as Recurrence,
    ];

    const total = computeReferenceIncome(cfg, recurrences, '2026-10');
    // 2500 (Nico) + 400 (CAF) = 2900 €
    expect(total).toBe(2900);
  });
});

describe('catégories de revenu de référence', () => {
  it('isSalaryOrCafCategory reconnaît salaires et CAF, sans tenir compte de la casse', () => {
    expect(isSalaryOrCafCategory('Salaire Nico')).toBe(true);
    expect(isSalaryOrCafCategory('CAF')).toBe(true);
    expect(isSalaryOrCafCategory('Allocations familiales')).toBe(true);
    expect(isSalaryOrCafCategory('Remboursement')).toBe(false);
    expect(isSalaryOrCafCategory(null)).toBe(false);
  });

  it('matchesIncomeCategory distingue deux salaires différents', () => {
    expect(matchesIncomeCategory('Salaire Nico', 'salaire nico')).toBe(true);
    expect(matchesIncomeCategory('Salaire Nico', 'Salaire Gwen')).toBe(false);
    expect(matchesIncomeCategory('CAF', 'Versement CAF')).toBe(true);
  });

  it('isAllowedIncomeCategory privilégie les catégories configurées', () => {
    expect(isAllowedIncomeCategory('Salaire Gwen')).toBe(true);
    expect(isAllowedIncomeCategory('Salaire Gwen', ['Salaire Nico'])).toBe(false);
    expect(isAllowedIncomeCategory('Salaire Nico', ['Salaire Nico'])).toBe(true);
    expect(isAllowedIncomeCategory('')).toBe(false);
  });
});

describe('computeDerivedRav — Option A Enveloppes, Récurrences exclues et Remboursements', () => {
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  it('exclut les dépenses d’enveloppes annuelles et déduit la provision mensuelle d’enveloppe', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 3000, categorie: 'Salaire' } },
    };
    const txs: Transaction[] = [
      tx({ montant: -200, categorie: 'Courses', date: `${currentMonthKey}-05` }),
      // Dépense ponctuelle d'enveloppe annuelle (ex: vacances)
      tx({ montant: -1200, categorie: 'Vacances', date: `${currentMonthKey}-10` }),
    ];
    const envelopeKeys = new Set(['vacances']);
    const envelopeProvision = 150; // 150 € / mois

    const res = computeDerivedRav(config, {
      monthKey: currentMonthKey,
      txList: txs,
      recurrences: [],
      envelopeKeys,
      envelopeProvision,
    });

    // totalDep ne doit inclure que Courses (-200 €), pas Vacances (-1200 €)
    expect(res.totalDep).toBe(-200);
    // provisions doit inclure la provision d'enveloppe (-150 €)
    expect(res.provisions).toBe(-150);
    // reste = 3000 (salaire) - 200 (courses) - 150 (provision vacances) = 2650 €
    expect(res.reste).toBe(2650);
  });

  it('ignore les récurrences de catégories exclues (ex: Prêt, Épargne) dans les provisions', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 3000, categorie: 'Salaire' } },
    };
    const recurrences: Recurrence[] = [
      {
        id: 'rec-pret',
        label: 'Prêt Immo',
        category: 'Prêt',
        expectedAmount: -1000,
        dayOfMonth: 10,
        active: true,
      } as Recurrence,
      {
        id: 'rec-internet',
        label: 'Fibre',
        category: 'Internet',
        expectedAmount: -40,
        dayOfMonth: 20,
        active: true,
      } as Recurrence,
    ];

    const res = computeDerivedRav(config, {
      monthKey: currentMonthKey,
      txList: [],
      recurrences,
    });

    // Seule la fibre (-40 €) doit être provisionnée, pas le prêt (-1000 €) qui est hors dépenses RAV
    expect(res.provisions).toBe(-40);
    expect(res.reste).toBe(2960);
  });

  it('ne calcule aucune provision « à venir » sur un mois passé clôturé', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 3000, categorie: 'Salaire' } },
    };
    const recurrences: Recurrence[] = [
      {
        id: 'rec-internet',
        label: 'Fibre',
        category: 'Internet',
        expectedAmount: -40,
        dayOfMonth: 20,
        active: true,
      } as Recurrence,
    ];

    const res = computeDerivedRav(config, {
      monthKey: '2020-01', // Mois très ancien
      txList: [],
      recurrences,
    });

    expect(res.provisions).toBe(0);
  });

  it('compense les remboursements sur une catégorie de dépense (dépenses nettes)', () => {
    const config: RavConfigFormValues = {
      ...baseConfig,
      provision_salaires: { nico: { montant: 3000, categorie: 'Salaire' } },
    };
    const txs: Transaction[] = [
      tx({ montant: -100, categorie: 'Santé', date: `${currentMonthKey}-02` }),
      tx({ montant: 30, categorie: 'Santé', date: `${currentMonthKey}-08` }), // Remboursement Sécu
    ];

    const res = computeDerivedRav(config, {
      monthKey: currentMonthKey,
      txList: txs,
      recurrences: [],
    });

    // Dépense nette Santé = -70 €
    expect(res.totalDep).toBe(-70);
    expect(res.reste).toBe(2930);
  });
});
