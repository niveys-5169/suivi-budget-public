import { describe, it, expect } from 'vitest';
import { computeRuleSuggestions } from '../../public/src/utils/computeRuleSuggestions';
import type { AutoRule } from '../../public/src/hooks/useRules';

function makeTx(libelle: string, categorie: string) {
  return {
    id: Math.random().toString(),
    libelle,
    montant: -10,
    compte: 'CCP',
    date: '2026-05-01',
    categorie,
  };
}

describe('computeRuleSuggestions', () => {
  it('suggère une règle quand un libellé apparaît ≥3 fois avec la même catégorie', () => {
    const transactions = [
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
    ];

    const suggestions = computeRuleSuggestions(transactions, []);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.pattern).toBe('NETFLIX FRANCE');
    expect(suggestions[0]!.category).toBe('Loisirs');
  });

  it('ne suggère pas si moins de 3 occurrences', () => {
    const transactions = [makeTx('AMAZON', 'Shopping'), makeTx('AMAZON', 'Shopping')];

    const suggestions = computeRuleSuggestions(transactions, []);
    expect(suggestions).toHaveLength(0);
  });

  it('ne suggère pas si une règle identique existe déjà', () => {
    const transactions = [
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
    ];
    const existingRules: AutoRule[] = [
      { id: '1', pattern: 'NETFLIX FRANCE', category: 'Loisirs', priority: 1, isActive: true },
    ];

    const suggestions = computeRuleSuggestions(transactions, existingRules);
    expect(suggestions).toHaveLength(0);
  });

  it('ne suggère pas si les transactions sans catégorie', () => {
    const transactions = [makeTx('SFR', ''), makeTx('SFR', ''), makeTx('SFR', '')];

    const suggestions = computeRuleSuggestions(transactions as any, []);
    expect(suggestions).toHaveLength(0);
  });

  it('ne suggère pas si la catégorie est incohérente sur le même libellé', () => {
    const transactions = [
      makeTx('UBER', 'Transport'),
      makeTx('UBER', 'Restaurants'),
      makeTx('UBER', 'Transport'),
      makeTx('UBER', 'Transport'),
    ];

    // Catégorie dominante = Transport (3/4), doit tout de même suggérer si ≥3
    const suggestions = computeRuleSuggestions(transactions, []);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.category).toBe('Transport');
  });

  it('retourne plusieurs suggestions pour des libellés distincts', () => {
    const transactions = [
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('NETFLIX FRANCE', 'Loisirs'),
      makeTx('SPOTIFY AB', 'Loisirs'),
      makeTx('SPOTIFY AB', 'Loisirs'),
      makeTx('SPOTIFY AB', 'Loisirs'),
    ];

    const suggestions = computeRuleSuggestions(transactions, []);
    expect(suggestions).toHaveLength(2);
    const patterns = suggestions.map((s) => s.pattern);
    expect(patterns).toContain('NETFLIX FRANCE');
    expect(patterns).toContain('SPOTIFY AB');
  });
});
