import { describe, it, expect } from 'vitest';
import { filterTransactions } from '../../public/src/utils/filterTransactions';
import type { Transaction } from '../../public/src/types/banking.types';
import type { TransactionFilters } from '../../public/src/context/TransactionContext';

const emptyFilters: TransactionFilters = {
  search: '',
  compte: '',
  type: '',
  year: '',
  month: '',
  pointe: '',
  categorie: '',
};

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: overrides.id ?? 't',
  date: overrides.date ?? '2026-04-15',
  libelle: overrides.libelle ?? 'tx',
  montant: overrides.montant ?? -10,
  compte: overrides.compte ?? 'LCL',
  pointe: overrides.pointe ?? false,
  categorie: overrides.categorie,
  commentaire: overrides.commentaire,
  moisAffectation: overrides.moisAffectation,
});

describe('filterTransactions', () => {
  describe('integrity guards', () => {
    it('drops transactions without a date', () => {
      const rows = [tx({ id: 'a', date: '2026-04-10' }), tx({ id: 'b', date: '' as string })];
      expect(filterTransactions(rows, emptyFilters, '').map((t) => t.id)).toEqual(['a']);
    });

    it('drops transactions without a libelle', () => {
      const rows = [tx({ id: 'a', libelle: 'ok' }), tx({ id: 'b', libelle: '' })];
      expect(filterTransactions(rows, emptyFilters, '').map((t) => t.id)).toEqual(['a']);
    });
  });

  describe('equality filters', () => {
    const rows = [
      tx({ id: 'a', compte: 'LCL', categorie: 'Courses', montant: -50, pointe: true }),
      tx({ id: 'b', compte: 'Boursorama', categorie: 'Salaire', montant: 2000, pointe: false }),
    ];

    it('compte filter keeps only matching accounts', () => {
      const out = filterTransactions(rows, { ...emptyFilters, compte: 'LCL' }, '');
      expect(out.map((t) => t.id)).toEqual(['a']);
    });

    it('type=dep keeps only negative amounts', () => {
      const out = filterTransactions(rows, { ...emptyFilters, type: 'dep' }, '');
      expect(out.map((t) => t.id)).toEqual(['a']);
    });

    it('type=rec keeps only positive amounts', () => {
      const out = filterTransactions(rows, { ...emptyFilters, type: 'rec' }, '');
      expect(out.map((t) => t.id)).toEqual(['b']);
    });

    it('type=dep rejects zero amounts (treated as income side)', () => {
      const zero = [tx({ id: 'z', montant: 0 })];
      expect(filterTransactions(zero, { ...emptyFilters, type: 'dep' }, '')).toHaveLength(0);
    });

    it('pointe=oui keeps only reconciled', () => {
      const out = filterTransactions(rows, { ...emptyFilters, pointe: 'oui' }, '');
      expect(out.map((t) => t.id)).toEqual(['a']);
    });

    it('pointe=non keeps only unreconciled', () => {
      const out = filterTransactions(rows, { ...emptyFilters, pointe: 'non' }, '');
      expect(out.map((t) => t.id)).toEqual(['b']);
    });

    it('categorie filter is exact (no substring)', () => {
      const out = filterTransactions(
        [tx({ id: 'a', categorie: 'Courses' }), tx({ id: 'b', categorie: 'Courses Alimentation' })],
        { ...emptyFilters, categorie: 'Courses' },
        '',
      );
      expect(out.map((t) => t.id)).toEqual(['a']);
    });

    it('missing categorie behaves as empty string for the equality check', () => {
      const out = filterTransactions(
        [tx({ id: 'a' }), tx({ id: 'b', categorie: 'Courses' })],
        { ...emptyFilters, categorie: '' },
        '',
      );
      // empty categorie filter is a no-op (always passes)
      expect(out.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('date filters', () => {
    const rows = [
      tx({ id: 'a', date: '2026-04-10' }), // April 2026
      tx({ id: 'b', date: '2026-03-05', moisAffectation: '2026-04' }), // logged March, affected April
      tx({ id: 'c', date: '2025-12-20' }), // December 2025
    ];

    it('year filter uses moisAffectation when present', () => {
      const out = filterTransactions(rows, { ...emptyFilters, year: '2026' }, '');
      expect(out.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });

    it('year filter falls back to date when moisAffectation is missing', () => {
      const out = filterTransactions(rows, { ...emptyFilters, year: '2025' }, '');
      expect(out.map((t) => t.id)).toEqual(['c']);
    });

    it('month filter matches the moisAffectation month component', () => {
      const out = filterTransactions(rows, { ...emptyFilters, month: '04' }, '');
      expect(out.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });

    it('year + month combined narrows further', () => {
      const out = filterTransactions(rows, { ...emptyFilters, year: '2026', month: '03' }, '');
      expect(out).toHaveLength(0);
    });
  });

  describe('free-text search', () => {
    const rows = [
      tx({ id: 'a', libelle: 'Café crème', commentaire: 'matin', montant: -3.5 }),
      tx({ id: 'b', libelle: 'Stations Total', commentaire: '', montant: -65.4 }),
      tx({ id: 'c', libelle: 'Salaire', commentaire: 'mai', montant: 2200 }),
    ];

    it('matches libelle case- and accent-insensitively', () => {
      expect(filterTransactions(rows, emptyFilters, 'CAFE').map((t) => t.id)).toEqual(['a']);
      expect(filterTransactions(rows, emptyFilters, 'créme').map((t) => t.id)).toEqual(['a']);
    });

    it('matches commentaire', () => {
      expect(filterTransactions(rows, emptyFilters, 'matin').map((t) => t.id)).toEqual(['a']);
    });

    it('matches a signed dot-decimal amount', () => {
      expect(filterTransactions(rows, emptyFilters, '-3.5').map((t) => t.id)).toEqual(['a']);
    });

    it('matches an unsigned comma-decimal amount', () => {
      expect(filterTransactions(rows, emptyFilters, '65,4').map((t) => t.id)).toEqual(['b']);
    });

    it('rejects rows whose libelle/commentaire/amount all miss', () => {
      expect(filterTransactions(rows, emptyFilters, 'foo')).toHaveLength(0);
    });

    it('treats whitespace-only search as empty', () => {
      const out = filterTransactions(rows, emptyFilters, '   ');
      expect(out).toHaveLength(rows.length);
    });
  });

  describe('sort order', () => {
    it('sorts descending by date (most recent first)', () => {
      const rows = [
        tx({ id: 'old', date: '2026-01-01' }),
        tx({ id: 'mid', date: '2026-02-15' }),
        tx({ id: 'new', date: '2026-04-20' }),
      ];
      const out = filterTransactions(rows, emptyFilters, '');
      expect(out.map((t) => t.id)).toEqual(['new', 'mid', 'old']);
    });
  });

  describe('composition', () => {
    it('compounds compte + type + search', () => {
      const rows = [
        tx({ id: 'a', compte: 'LCL', montant: -20, libelle: 'Café crème' }),
        tx({ id: 'b', compte: 'LCL', montant: 100, libelle: 'Café virement' }),
        tx({ id: 'c', compte: 'Bourso', montant: -20, libelle: 'Café latte' }),
      ];
      const out = filterTransactions(rows, { ...emptyFilters, compte: 'LCL', type: 'dep' }, 'cafe');
      expect(out.map((t) => t.id)).toEqual(['a']);
    });
  });
});
