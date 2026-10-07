import { describe, it, expect } from 'vitest';
import { computeBudgetAdjustment } from '../recurrenceBudget';
import type { BudgetBase } from '../../types/banking.types';

const budget = (over: Partial<BudgetBase> = {}): BudgetBase => ({
  id: 'Assurance',
  categorie: 'Assurance',
  nom: 'Assurance',
  montant: 100,
  actif: true,
  type: 'mensuel',
  ...over,
});

describe('computeBudgetAdjustment', () => {
  it('budget mensuel : applique l’écart ancien → nouveau montant', () => {
    expect(computeBudgetAdjustment([budget()], 'Assurance', 40, 45)).toEqual({
      budget: budget(),
      montant: 105,
    });
  });

  it('budget annuel : l’écart mensuel est multiplié par 12', () => {
    const annual = budget({ type: 'annuel', montant: 1200 });
    expect(computeBudgetAdjustment([annual], 'Assurance', 40, 45)?.montant).toBe(1260);
  });

  it('baisse : jamais sous zéro', () => {
    expect(computeBudgetAdjustment([budget({ montant: 3 })], 'Assurance', 40, 30)?.montant).toBe(0);
  });

  it('catégorie insensible à la casse et aux espaces', () => {
    expect(computeBudgetAdjustment([budget()], ' assurance ', 40, 45)).not.toBeNull();
  });

  it.each([
    ['aucun budget', []],
    ['budget inactif', [budget({ actif: false })]],
    ['budget de revenu', [budget({ isIncome: true })]],
    ['type ponctuel', [budget({ type: 'ponctuel' })]],
    ['autre catégorie', [budget({ categorie: 'Loisirs' })]],
  ])('%s → null', (_label, list) => {
    expect(computeBudgetAdjustment(list, 'Assurance', 40, 45)).toBeNull();
  });

  it('écart nul → null (rien à écrire)', () => {
    expect(computeBudgetAdjustment([budget()], 'Assurance', 40, 40)).toBeNull();
  });
});
