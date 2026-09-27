/**
 * Catégories ajoutées / supprimées par l'utilisateur, persistées dans
 * `users/{uid}/preferences/categories`. Une catégorie supprimée est seulement
 * masquée des listes de choix : les transactions existantes la conservent.
 */
export interface CustomCategories {
  added: string[];
  removed: string[];
}

export const EMPTY_CUSTOM_CATEGORIES: CustomCategories = { added: [], removed: [] };

/** Candidats de base ∪ ajoutées, privés des supprimées, triés (fr). */
export function applyCustomCategories(base: string[], custom: CustomCategories): string[] {
  const removed = new Set(custom.removed);
  return Array.from(new Set([...base, ...custom.added]))
    .filter((c) => Boolean(c) && !removed.has(c))
    .sort((a, b) => a.localeCompare(b, 'fr'));
}
