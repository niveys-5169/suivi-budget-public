import { describe, it, expect } from 'vitest';
import { sortBudgetCategories, mergeManualOrder } from '../budgetSort';

const cats = () => [
  { id: 'Loisirs', nom: 'Loisirs', montant: 100 },
  { id: 'Alimentation', nom: 'Alimentation', montant: 400 },
  { id: 'Énergie', nom: 'Énergie', montant: 150 },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('sortBudgetCategories', () => {
  it('montant : budget décroissant', () => {
    expect(ids(sortBudgetCategories(cats(), 'montant', []))).toEqual([
      'Alimentation',
      'Énergie',
      'Loisirs',
    ]);
  });

  it('alpha : ordre alphabétique français (accents)', () => {
    expect(ids(sortBudgetCategories(cats(), 'alpha', []))).toEqual([
      'Alimentation',
      'Énergie',
      'Loisirs',
    ]);
  });

  it('manuel : ordre mémorisé, catégories inconnues à la fin par ordre alphabétique', () => {
    expect(ids(sortBudgetCategories(cats(), 'manual', ['Loisirs']))).toEqual([
      'Loisirs',
      'Alimentation',
      'Énergie',
    ]);
  });
});

describe('mergeManualOrder', () => {
  it("préserve l'ordre de l'autre grille", () => {
    expect(mergeManualOrder(['Salaire', 'A', 'B'], ['B', 'A'])).toEqual(['Salaire', 'B', 'A']);
  });
});
