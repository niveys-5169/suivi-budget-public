import { describe, it, expect } from 'vitest';
import { normalizeTransaction } from '../transactionRepository';

const doc = { id: 'tx1', date: '2026-10-28', libelle: 'VIR SOLDE', montant: 12000 };

describe('normalizeTransaction — ventilation', () => {
  it('lit les parts ventilées', () => {
    const tx = normalizeTransaction({
      ...doc,
      ventilation: [{ montant: 2450, categorie: 'Salaire', moisAffectation: '2026-10' }],
    });
    expect(tx?.ventilation).toEqual([
      { montant: 2450, categorie: 'Salaire', moisAffectation: '2026-10' },
    ]);
  });

  it('ignore une ventilation malformée sans rejeter la transaction', () => {
    const tx = normalizeTransaction({ ...doc, ventilation: [{ montant: 'x' }] });
    expect(tx?.montant).toBe(12000);
    expect(tx?.ventilation).toBeUndefined();
  });
});
