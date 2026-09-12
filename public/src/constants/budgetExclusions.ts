/**
 * Catégories exclues par défaut des calculs de budget (virements internes, épargne, etc.).
 * Sert de repli tant que l'utilisateur n'a pas personnalisé sa liste via la PWA
 * (document Firestore `metadata/budget_excluded_categories`).
 */
export const DEFAULT_BUDGET_EXCLUDED_CATEGORIES: string[] = [
  'Virements internes',
  'Virement interne',
  'Retrait Epargne',
  'Retraits epargne',
  'Retrait Épargne',
  'Retraits épargne',
];
