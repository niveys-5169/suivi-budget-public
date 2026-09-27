import { describe, it, expect } from 'vitest';
import { applyCustomCategories, EMPTY_CUSTOM_CATEGORIES } from '../customCategories';

describe('applyCustomCategories', () => {
  it('ajoute les catégories personnalisées et trie', () => {
    expect(applyCustomCategories(['Sport', 'Eau'], { added: ['Animaux'], removed: [] })).toEqual([
      'Animaux',
      'Eau',
      'Sport',
    ]);
  });

  it('masque les catégories supprimées, même présentes dans la base', () => {
    expect(applyCustomCategories(['Sport', 'Eau'], { added: [], removed: ['Sport'] })).toEqual([
      'Eau',
    ]);
  });

  it('dédoublonne et ignore les valeurs vides', () => {
    expect(applyCustomCategories(['Eau', '', 'Eau'], { added: ['Eau'], removed: [] })).toEqual([
      'Eau',
    ]);
  });

  it('sans personnalisation, renvoie la base triée', () => {
    expect(applyCustomCategories(['b', 'a'], EMPTY_CUSTOM_CATEGORIES)).toEqual(['a', 'b']);
  });
});
