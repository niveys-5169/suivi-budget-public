import type { AutoRule } from '../hooks/useRules';

export interface RuleSuggestion {
  pattern: string;
  category: string;
  count: number;
}

export function computeRuleSuggestions(
  transactions: Array<{
    libelle?: string;
    merchantName?: string;
    categorie?: string;
    category?: string;
  }>,
  existingRules: AutoRule[],
  minOccurrences = 3,
): RuleSuggestion[] {
  const existingPatterns = new Set(existingRules.map((r) => r.pattern.toLowerCase()));

  // Count occurrences per (libelle, categorie) pair
  const counts = new Map<string, Map<string, number>>();
  for (const tx of transactions) {
    const libelle = (tx.libelle || '').trim();
    const cat = (tx.categorie || '').trim();
    if (!libelle || !cat) continue;

    if (!counts.has(libelle)) counts.set(libelle, new Map());
    const catMap = counts.get(libelle)!;
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  }

  const suggestions: RuleSuggestion[] = [];

  for (const [libelle, catMap] of counts) {
    if (existingPatterns.has(libelle.toLowerCase())) continue;

    // Pick the most frequent category for this libellé
    let topCat = '';
    let topCount = 0;
    for (const [cat, count] of catMap) {
      if (count > topCount) {
        topCat = cat;
        topCount = count;
      }
    }

    if (topCount >= minOccurrences) {
      suggestions.push({ pattern: libelle, category: topCat, count: topCount });
    }
  }

  return suggestions.sort((a, b) => b.count - a.count);
}
