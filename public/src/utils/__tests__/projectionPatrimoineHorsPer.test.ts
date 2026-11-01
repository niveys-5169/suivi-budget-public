import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types/banking.types';
import { computePatrimoineHorsPer } from '../projection/patrimoineHorsPer';
import { toStoredTransactions } from '../projection/storedTransactions';
import { expandVentilations } from '../ventilation';

describe('computePatrimoineHorsPer', () => {
  const totals = { courants: 1000, epargne: 5000, bourse: 20000, per: 8000, immobilier: 300000 };

  it('somme courants + épargne + bourse, sans PER ni immobilier', () => {
    expect(computePatrimoineHorsPer(totals, false)).toBe(26000);
  });

  it('retourne null tant que les données patrimoine chargent', () => {
    expect(computePatrimoineHorsPer(totals, true)).toBeNull();
  });

  it('arrondit au centime', () => {
    expect(
      computePatrimoineHorsPer({ ...totals, courants: 0.1, epargne: 0.2, bourse: 0 }, false),
    ).toBe(0.3);
  });
});

describe('toStoredTransactions', () => {
  const base: Transaction = {
    id: 't1',
    date: '2026-01-10',
    libelle: 'Op',
    montant: -100,
    compte: 'Compte test',
    pointe: true,
    categorie: 'Courses',
    ventilation: [{ montant: -30, categorie: 'Loisirs' }],
  };

  it('retrouve les transactions stockées depuis les lignes ventilées', () => {
    const other: Transaction = { ...base, id: 't2', ventilation: undefined };
    const rows = expandVentilations([base, other]);
    expect(rows).toHaveLength(3);
    const stored = toStoredTransactions(rows);
    expect(stored.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(stored[0]).toBe(base);
  });

  it('laisse inchangée une liste sans ventilation', () => {
    const plain = { ...base, ventilation: undefined };
    expect(toStoredTransactions([plain])).toEqual([plain]);
  });
});
