import type { ProjectionClasseCategorie } from '../../types/banking.types';

/** Minuscules, sans accents. */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Catégories connues de l'app, nécessaires à la classification par défaut. */
export interface CategoryClassContext {
  revenuCategories: string[];
  creditCategories: string[];
  excludedCategories: string[];
}

/**
 * Classe par défaut d'une catégorie de transactions (règle de l'onglet ⑨).
 * Les classes explicites de `ProjectionParams.classesCategories` priment.
 */
export function defaultCategoryClass(
  categorie: string,
  ctx: CategoryClassContext,
): ProjectionClasseCategorie {
  const nom = normalize(categorie);
  if (ctx.revenuCategories.includes(categorie)) return 'revenu';
  if (ctx.creditCategories.includes(categorie) || nom.startsWith('credit')) return 'fixe';
  if (ctx.excludedCategories.includes(categorie)) return 'exclu';
  if (nom === 'epargne' || nom.startsWith('retrait epargne')) return 'tresorerie';
  if (nom.includes('virement interne') || nom.includes('virements internes')) return 'interne';
  if (nom.includes('remboursement') || nom.includes('autres revenus')) return 'ponctuel';
  return 'depense';
}
