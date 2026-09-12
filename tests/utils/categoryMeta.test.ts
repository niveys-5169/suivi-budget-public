import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCategoryMeta,
  setCategoryOverrides,
  hasExplicitCategoryMeta,
  BUILTIN_CATEGORY_META,
} from '../../public/src/constants/categoryMetadata';

describe('categoryMeta resolver', () => {
  beforeEach(() => {
    setCategoryOverrides({});
  });

  it('returns the built-in meta for a known category', () => {
    expect(getCategoryMeta('Transport')).toEqual(BUILTIN_CATEGORY_META['Transport']);
  });

  it('falls back to the generic "?" meta for an unknown category', () => {
    expect(getCategoryMeta('Catégorie Inexistante ZZZ')).toEqual({
      icon: 'help-circle',
      color: '#71717A',
    });
  });

  it('provides a smart built-in icon for real budget categories', () => {
    expect(getCategoryMeta('Netflix').icon).toBe('tv');
    expect(getCategoryMeta('Salaire Nico').icon).toBe('banknote');
    expect(getCategoryMeta('Vacances ski').icon).toBe('mountain-snow');
  });

  it('falls back to "Non catégorisé" when no category is given', () => {
    expect(getCategoryMeta()).toEqual(BUILTIN_CATEGORY_META['Non catégorisé']);
  });

  it('lets a user override take priority over the built-in map', () => {
    setCategoryOverrides({ Transport: { icon: 'plane', color: '#000000' } });
    expect(getCategoryMeta('Transport')).toEqual({ icon: 'plane', color: '#000000' });
  });

  it('lets a user override give an icon to a previously unknown category', () => {
    setCategoryOverrides({ Netflix: { icon: 'tv', color: '#E50914' } });
    expect(getCategoryMeta('Netflix')).toEqual({ icon: 'tv', color: '#E50914' });
    expect(hasExplicitCategoryMeta('Netflix')).toBe(true);
  });

  it('hasExplicitCategoryMeta is false for unmapped categories', () => {
    expect(hasExplicitCategoryMeta('Catégorie Inexistante ZZZ')).toBe(false);
    expect(hasExplicitCategoryMeta()).toBe(false);
  });
});
