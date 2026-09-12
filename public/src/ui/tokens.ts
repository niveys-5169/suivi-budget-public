/**
 * AURUM v3 — Miroir TypeScript des tokens.
 *
 * `tokens.css` reste la source de vérité pour tout ce qui passe par une classe
 * Tailwind. Ce fichier existe pour les cas où une valeur doit être lue en JS :
 * Recharts, styles inline, canvas, méta-tags.
 *
 * Les deux fichiers sont vérifiés par tests/ui/tokens.test.ts.
 */

export const color = {
  bg: '#0B0B14',
  surface: '#15151F',
  raised: '#1D1D2A',
  separator: 'rgba(255, 255, 255, 0.08)',

  label: '#F5F5F7',
  labelSecondary: 'rgba(245, 245, 247, 0.60)',
  labelTertiary: 'rgba(245, 245, 247, 0.38)',

  gold: '#D4AF37',
  goldLight: '#E5C158',
  goldSubtle: 'rgba(212, 175, 55, 0.10)',

  positive: '#4ADE80',
  negative: '#F87171',
  warning: '#F59E0B',
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Grille de 8 px. `xs` (4 px) est le seul sous-pas autorisé. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

/** Hauteurs canoniques, toutes multiples de 8. */
export const size = {
  navbar: 56,
  tabbar: 56,
  row: 56,
  rowCompact: 48,
  control: 44,
  controlSm: 36,
  controlLg: 52,
} as const;

export const font = {
  ui: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  serif: "'Playfair Display', Georgia, serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
} as const;

/**
 * Palette catégories — désaturée pour fond sombre, luminance harmonisée.
 *
 * Remplace les `var(--cat-*)` de `utils/categoryUtils.ts`, qui référençaient
 * des variables CSS déclarées nulle part depuis la suppression du legacy :
 * toutes les couleurs de catégorie se résolvaient à vide.
 */
export const categoryColor = {
  housing: '#7C6BA8',
  transport: '#3BA8A8',
  food: '#C8956F',
  health: '#E98A8A',
  entertainment: '#E8A55F',
  shopping: '#CF9AB2',
  utilities: '#8BA6C4',
  savings: '#6FB89A',
  income: '#4ADE80',
  other: '#8B8B96',
} as const;

export type CategoryColorKey = keyof typeof categoryColor;

/** Ordre stable pour l'attribution automatique d'une couleur de série. */
export const chartSeries: readonly string[] = [
  categoryColor.housing,
  categoryColor.transport,
  categoryColor.food,
  categoryColor.health,
  categoryColor.entertainment,
  categoryColor.shopping,
  categoryColor.utilities,
  categoryColor.savings,
  categoryColor.other,
];

/** Couleur déterministe pour un libellé arbitraire (catégorie inconnue). */
export function seriesColorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return chartSeries[hash % chartSeries.length] as string;
}

/** Couleur d'un montant. L'or n'est plus utilisé pour la valeur financière. */
export function amountColor(value: number): string {
  if (value > 0) return color.positive;
  if (value < 0) return color.negative;
  return color.labelSecondary;
}

/** Couleur d'une jauge de budget selon le taux de consommation. */
export function gaugeColor(ratio: number): string {
  if (ratio >= 1) return color.negative;
  if (ratio >= 0.8) return color.warning;
  return color.gold;
}
