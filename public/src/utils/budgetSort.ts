import type { BudgetSortMode } from '../hooks/usePreferences';

interface SortableCategory {
  id: string;
  nom: string;
  montant: number;
}

/** Trie en place une liste de catégories selon le mode choisi (partagé PC / mobile). */
export function sortBudgetCategories<T extends SortableCategory>(
  list: T[],
  mode: BudgetSortMode,
  manualOrder: string[],
): T[] {
  if (mode === 'alpha') {
    return list.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }
  if (mode === 'manual') {
    const orderIndex = new Map(manualOrder.map((id, i) => [id, i]));
    return list.sort((a, b) => {
      const ia = orderIndex.get(a.id) ?? Infinity;
      const ib = orderIndex.get(b.id) ?? Infinity;
      if (ia !== ib) return ia - ib;
      return a.nom.localeCompare(b.nom, 'fr');
    });
  }
  return list.sort((a, b) => b.montant - a.montant);
}

/**
 * Fusionne l'ordre d'une grille (revenus OU dépenses) avec l'ordre manuel global,
 * sans perturber l'ordre déjà mémorisé pour l'autre grille.
 */
export function mergeManualOrder(manualOrder: string[], reorderedIds: string[]): string[] {
  const reorderedSet = new Set(reorderedIds);
  return [...manualOrder.filter((id) => !reorderedSet.has(id)), ...reorderedIds];
}
