import { describe, it, expect } from 'vitest';
import type { BudgetBase } from '../../types/banking.types';
import { manualOrderComparator, moveBudget, sortBudgetsByType } from '../budgetManagerHelpers';

const budget = (categorie: string, extra: Partial<BudgetBase> = {}): BudgetBase => ({
  id: categorie,
  categorie,
  nom: categorie,
  montant: 100,
  actif: true,
  type: 'mensuel',
  ...extra,
});

const names = (list: BudgetBase[]) => list.map((b) => b.categorie);

describe('manualOrderComparator', () => {
  it('trie par ordre manuel, puis les enveloppes sans ordre selon le repli', () => {
    const items = [
      { id: 'a', ordre: undefined, montant: 10 },
      { id: 'b', ordre: 1, montant: 5 },
      { id: 'c', ordre: undefined, montant: 50 },
      { id: 'd', ordre: 0, montant: 1 },
    ];
    const sorted = [...items].sort(
      manualOrderComparator(
        (x) => x.ordre,
        (x, y) => y.montant - x.montant,
      ),
    );
    expect(sorted.map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('sortBudgetsByType', () => {
  it("respecte l'ordre manuel à l'intérieur de chaque groupe", () => {
    const sorted = sortBudgetsByType([
      budget('Alimentation', { ordre: 1 }),
      budget('Salaire', { type: 'revenu', isIncome: true, ordre: 0 }),
      budget('Loisirs', { ordre: 0 }),
      budget('Transport'),
    ]);
    expect(names(sorted)).toEqual(['Loisirs', 'Alimentation', 'Transport', 'Salaire']);
  });
});

describe('moveBudget', () => {
  const list = [
    budget('Alimentation'),
    budget('Loisirs'),
    budget('Salaire', { type: 'revenu', isIncome: true }),
  ];

  it("échange l'enveloppe avec sa voisine", () => {
    expect(names(moveBudget(list, 1, -1)!)).toEqual(['Loisirs', 'Alimentation', 'Salaire']);
    expect(names(moveBudget(list, 0, 1)!)).toEqual(['Loisirs', 'Alimentation', 'Salaire']);
  });

  it('refuse de sortir de la liste', () => {
    expect(moveBudget(list, 0, -1)).toBeNull();
    expect(moveBudget(list, 2, 1)).toBeNull();
  });

  it('refuse de franchir la frontière dépenses / revenus', () => {
    expect(moveBudget(list, 1, 1)).toBeNull();
    expect(moveBudget(list, 2, -1)).toBeNull();
  });
});
