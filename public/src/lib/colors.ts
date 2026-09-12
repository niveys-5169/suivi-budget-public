/** Couleurs sémantiques des charts (SVG/Recharts ne consomment pas les classes Tailwind). */
export const CHART_COLORS = {
  gold: '#D4AF37',
  emerald: '#10B981',
  ruby: '#B91C1C',
  blue: '#3B82F6',
  violet: '#8B5CF6',
  amber: '#F59E0B',
  pink: '#EC4899',
  /** Ticks d'axes (zinc-600). */
  axis: '#52525B',
  /** Fond des tooltips Recharts. */
  tooltipBg: '#0F0F1A',
  /** Encre profonde (contours sur fond clair, activeDot stroke). */
  ink: '#0B0B14',
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  'Auto & Transports': '#00A8A8',
  Transport: '#00A8A8',
  Carburant: '#00A8A8',
  Logement: '#6B5B95',
  Loyer: '#6B5B95',
  Alimentation: '#C8956F',
  Courses: '#C8956F',
  Restauration: '#C8956F',
  Santé: '#E98080',
  Médecin: '#E98080',
  Pharmacie: '#E98080',
  Loisirs: '#F5A962',
  Sport: '#F5A962',
  Vacances: '#F5A962',
  Shopping: '#D9A4B8',
  Vêtements: '#D9A4B8',
  Abonnements: '#88A4C2',
  Téléphone: '#88A4C2',
  Internet: '#88A4C2',
  Banque: '#5B8DB8',
  Retraits: '#5B8DB8',
  'Impôts & Taxes': '#A0897A',
  Impôts: '#A0897A',
  'Dépenses pro': '#7B8FA1',
  'Frais Pros': '#7B8FA1',
  'Autres rentrées': '#D4AF37',
  Revenus: '#D4AF37',
  Salaire: '#D4AF37',
  Épargne: '#52B788',
  Esthétique: '#C084A0',
  Divers: '#8B8B8B',
};

export function getCategoryColor(categorie: string): string {
  if (!categorie) return '#8B8B8B';
  if (CATEGORY_COLORS[categorie]) return CATEGORY_COLORS[categorie];
  const key = Object.keys(CATEGORY_COLORS).find(
    (k) =>
      categorie.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(categorie.toLowerCase()),
  );
  return key ? (CATEGORY_COLORS[key] ?? '#8B8B8B') : '#8B8B8B';
}

export function getCategoryColorMuted(categorie: string, alpha = 0.15): string {
  const hex = getCategoryColor(categorie);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
