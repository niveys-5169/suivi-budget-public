export interface CategoryMeta {
  icon: string;
  color: string;
}

/**
 * Icônes/couleurs intégrées par défaut. Sert de repli quand l'utilisateur n'a pas
 * personnalisé une catégorie. Couvre à la fois des libellés génériques et les
 * catégories réelles du budget (cf. `constants/categories.ts`).
 */
export const BUILTIN_CATEGORY_META: Record<string, CategoryMeta> = {
  // — Libellés génériques —
  Alimentation: { icon: 'utensils', color: '#F97316' },
  Restaurant: { icon: 'utensils', color: '#F97316' },
  Courses: { icon: 'shopping-cart', color: '#F97316' },
  Transport: { icon: 'car', color: '#3B82F6' },
  Carburant: { icon: 'fuel', color: '#3B82F6' },
  Logement: { icon: 'home', color: '#10B981' },
  Loyer: { icon: 'home', color: '#10B981' },
  Santé: { icon: 'activity', color: '#EF4444' },
  Pharmacie: { icon: 'activity', color: '#EF4444' },
  Loisirs: { icon: 'film', color: '#EC4899' },
  Shopping: { icon: 'shopping-bag', color: '#A855F7' },
  Vêtements: { icon: 'shirt', color: '#A855F7' },
  Investissement: { icon: 'trending-up', color: '#D4AF37' },
  Épargne: { icon: 'trending-up', color: '#D4AF37' },
  Abonnement: { icon: 'refresh-cw', color: '#6366F1' },
  'Non catégorisé': { icon: 'help-circle', color: '#71717A' },

  // — Dépenses (catégories réelles) —
  'A Catégoriser': { icon: 'help-circle', color: '#71717A' },
  'Achats shopping autres': { icon: 'shopping-bag', color: '#A855F7' },
  'Apple Music': { icon: 'music', color: '#EC4899' },
  'Assistance juridique': { icon: 'scale', color: '#6366F1' },
  'Assurance crédit Maison Gwen': { icon: 'shield', color: '#10B981' },
  'Assurance crédit Maison Nico': { icon: 'shield', color: '#10B981' },
  'Assurance Extension Gwen': { icon: 'shield', color: '#10B981' },
  'Assurance Extension Nico': { icon: 'shield', color: '#10B981' },
  'Assurance habitation': { icon: 'shield', color: '#10B981' },
  'Assurance voiture': { icon: 'shield', color: '#3B82F6' },
  'Cantine + Alae + Centre': { icon: 'graduation-cap', color: '#F97316' },
  'CFDT Nico': { icon: 'users', color: '#6366F1' },
  'Crédit Extension': { icon: 'landmark', color: '#EF4444' },
  'Crédit Maison': { icon: 'home', color: '#EF4444' },
  'Crédit Maison ProBTP': { icon: 'home', color: '#EF4444' },
  'Crédit voiture': { icon: 'car', color: '#EF4444' },
  Eau: { icon: 'droplet', color: '#06B6D4' },
  EDF: { icon: 'plug-zap', color: '#EAB308' },
  'Electricité voiture': { icon: 'battery-charging', color: '#84CC16' },
  'Entretien Clim/Chauffage': { icon: 'flame', color: '#F97316' },
  'Entretien voiture + Pneus': { icon: 'wrench', color: '#3B82F6' },
  Epargne: { icon: 'piggy-bank', color: '#D4AF37' },
  Extension: { icon: 'home', color: '#10B981' },
  'Fibre SFR': { icon: 'wifi', color: '#6366F1' },
  'Frais bancaires': { icon: 'landmark', color: '#71717A' },
  Habits: { icon: 'shirt', color: '#A855F7' },
  iCloud: { icon: 'cloud', color: '#71717A' },
  'Impots fonciers': { icon: 'landmark', color: '#EF4444' },
  'Kdo Anniversaire nous 4': { icon: 'gift', color: '#EC4899' },
  'Kdos Anniversaires': { icon: 'gift', color: '#EC4899' },
  'Mobile Gwen': { icon: 'smartphone', color: '#6366F1' },
  'Mobile Nico': { icon: 'smartphone', color: '#6366F1' },
  Netflix: { icon: 'tv', color: '#EF4444' },
  'Noel Famille': { icon: 'gift', color: '#EF4444' },
  'Noels nous 4': { icon: 'gift', color: '#EF4444' },
  'Notes de frais': { icon: 'receipt', color: '#71717A' },
  Nourriture: { icon: 'utensils', color: '#F97316' },
  Prime: { icon: 'coins', color: '#D4AF37' },
  'Renouvellement Electronique/electromenager': { icon: 'laptop', color: '#06B6D4' },
  Sorties: { icon: 'wine', color: '#EC4899' },
  Sport: { icon: 'dumbbell', color: '#84CC16' },
  'Travaux maison': { icon: 'hammer', color: '#F97316' },
  'Vacances Autres': { icon: 'plane', color: '#06B6D4' },
  'Vacances été (Bretagne)': { icon: 'sun', color: '#EAB308' },
  'Vacances Noel (Bretagne)': { icon: 'snowflake', color: '#3B82F6' },
  'Vacances Novembre': { icon: 'plane-takeoff', color: '#06B6D4' },
  'Vacances ski': { icon: 'mountain-snow', color: '#3B82F6' },

  // — Revenus —
  'Autres revenus': { icon: 'coins', color: '#10B981' },
  CAF: { icon: 'baby', color: '#10B981' },
  'Prime vacance': { icon: 'sun', color: '#10B981' },
  Remboursement: { icon: 'hand-coins', color: '#10B981' },
  'Retrait Epargne': { icon: 'piggy-bank', color: '#D4AF37' },
  'Salaire Gwen': { icon: 'banknote', color: '#10B981' },
  'Salaire Nico': { icon: 'banknote', color: '#10B981' },
  'Virements internes': { icon: 'arrow-right-left', color: '#71717A' },
};

const FALLBACK_META: CategoryMeta = { icon: 'help-circle', color: '#71717A' };

/**
 * Surcharges utilisateur (icône/couleur par catégorie), peuplées depuis Firestore
 * par le CategoryMetaProvider. Stockées au niveau module pour que `getCategoryMeta`
 * reste un getter synchrone utilisable par tous les composants existants.
 */
let overrides: Record<string, CategoryMeta> = {};
const listeners = new Set<() => void>();

/** Remplace l'ensemble des surcharges et notifie les abonnés (useSyncExternalStore). */
export function setCategoryOverrides(next: Record<string, CategoryMeta> | null | undefined): void {
  overrides = next ?? {};
  listeners.forEach((l) => l());
}

export function getCategoryOverrides(): Record<string, CategoryMeta> {
  return overrides;
}

export function subscribeCategoryMeta(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Résout l'icône + couleur d'une catégorie.
 * Priorité : surcharge utilisateur → map intégrée → repli générique « ? ».
 */
export function getCategoryMeta(cat?: string): CategoryMeta {
  if (!cat) return overrides['Non catégorisé'] ?? BUILTIN_CATEGORY_META['Non catégorisé']!;
  return overrides[cat] ?? BUILTIN_CATEGORY_META[cat] ?? FALLBACK_META;
}

/** True si la catégorie possède une icône explicite (surcharge ou intégrée), pas le repli. */
export function hasExplicitCategoryMeta(cat?: string): boolean {
  if (!cat) return false;
  return cat in overrides || cat in BUILTIN_CATEGORY_META;
}
