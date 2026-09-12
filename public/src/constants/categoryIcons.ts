/**
 * Liste sélectionnable d'icônes Lucide (en kebab-case, comme attendu par <CategoryIcon/>).
 * Curated plutôt qu'exhaustive (~1500 icônes Lucide) pour une grille lisible et recherchable.
 * Regroupée par thème pour faciliter le repérage dans l'éditeur.
 */
export interface IconGroup {
  label: string;
  icons: string[];
}

export const CATEGORY_ICON_GROUPS: IconGroup[] = [
  {
    label: 'Alimentation',
    icons: [
      'utensils',
      'utensils-crossed',
      'shopping-cart',
      'shopping-basket',
      'coffee',
      'wine',
      'beer',
      'pizza',
      'apple',
      'cake',
      'cookie',
      'milk',
    ],
  },
  {
    label: 'Maison & Énergie',
    icons: [
      'home',
      'house',
      'bed',
      'sofa',
      'lamp',
      'lightbulb',
      'plug',
      'plug-zap',
      'droplet',
      'droplets',
      'flame',
      'wrench',
      'hammer',
      'paint-roller',
      'trees',
    ],
  },
  {
    label: 'Transport',
    icons: [
      'car',
      'car-front',
      'fuel',
      'bus',
      'train-front',
      'plane',
      'bike',
      'ship',
      'parking-circle',
      'zap',
      'battery-charging',
    ],
  },
  {
    label: 'Santé & Sport',
    icons: [
      'activity',
      'heart-pulse',
      'pill',
      'stethoscope',
      'cross',
      'dumbbell',
      'bike',
      'footprints',
      'brain',
    ],
  },
  {
    label: 'Loisirs & Abos',
    icons: [
      'film',
      'tv',
      'music',
      'gamepad-2',
      'headphones',
      'ticket',
      'popcorn',
      'palette',
      'book-open',
      'camera',
      'plane-takeoff',
      'tent',
      'umbrella',
      'gift',
      'party-popper',
    ],
  },
  {
    label: 'Achats',
    icons: [
      'shopping-bag',
      'shirt',
      'glasses',
      'watch',
      'gem',
      'smartphone',
      'laptop',
      'monitor',
      'baby',
      'dog',
      'cat',
    ],
  },
  {
    label: 'Finances',
    icons: [
      'trending-up',
      'trending-down',
      'piggy-bank',
      'banknote',
      'coins',
      'wallet',
      'credit-card',
      'landmark',
      'receipt',
      'percent',
      'briefcase',
      'graduation-cap',
      'scale',
      'file-text',
    ],
  },
  {
    label: 'Divers',
    icons: [
      'help-circle',
      'package',
      'tag',
      'star',
      'bell',
      'phone',
      'wifi',
      'mail',
      'calendar',
      'users',
      'user',
      'shield',
      'sparkles',
    ],
  },
];

/** Toutes les icônes sélectionnables, à plat (déduplication). */
export const ALL_CATEGORY_ICONS: string[] = Array.from(
  new Set(CATEGORY_ICON_GROUPS.flatMap((g) => g.icons)),
);

/** Palette de couleurs sélectionnable (alignée sur le Design System AURUM). */
export const CATEGORY_COLORS: string[] = [
  '#F97316', // orange
  '#EF4444', // rouge
  '#EC4899', // rose
  '#A855F7', // violet
  '#6366F1', // indigo
  '#3B82F6', // bleu
  '#06B6D4', // cyan
  '#10B981', // vert
  '#84CC16', // lime
  '#EAB308', // jaune
  '#D4AF37', // gold (marque)
  '#71717A', // zinc (neutre)
];
