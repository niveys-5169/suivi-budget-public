/**
 * Catégories exclues par défaut des calculs de budget (virements internes, épargne, etc.).
 * Sert de repli tant que l'utilisateur n'a pas personnalisé sa liste via la PWA
 * (document Firestore `metadata/budget_excluded_categories`).
 */
import { PATRIMONIAL_FLOW_CATEGORY_ALIASES } from './transactionFlowCategories';

export const DEFAULT_BUDGET_EXCLUDED_CATEGORIES: string[] = [...PATRIMONIAL_FLOW_CATEGORY_ALIASES];
