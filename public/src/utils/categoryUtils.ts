import { state } from '../store';
import { color as token, categoryColor } from '../ui/tokens';

/**
 * Palette des catégories.
 *
 * Ces couleurs étaient auparavant exprimées en `var(--cat-red)`, `var(--cat-blue)`…
 * — des variables CSS qui n'étaient déclarées dans AUCUNE feuille de style
 * vivante depuis la suppression du legacy : toutes les couleurs de catégorie se
 * résolvaient à vide. Elles pointent désormais sur la palette de `ui/tokens.ts`.
 */
const CAT = {
  red: categoryColor.health,
  orange: categoryColor.housing,
  yellow: categoryColor.entertainment,
  green: categoryColor.food,
  emerald: categoryColor.income,
  blue: categoryColor.transport,
  indigo: categoryColor.utilities,
  purple: categoryColor.housing,
  pink: categoryColor.shopping,
  slate: categoryColor.other,
} as const;

/** Fond translucide dérivé d'une couleur de catégorie (hex ou rgb). */
export function categoryBg(hex: string, alpha = 0.12): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return token.separator;
  const n = parseInt(m[1] as string, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const ICONS = {
  Sante: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  Logement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  Transport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M7 21h0"/><path d="M17 21h0"/><path d="M4 18h16"/></svg>`,
  Alimentation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
  Loisirs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  Courses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  Services: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  Revenus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12h.01"/><path d="M17 12h.01"/><path d="M7 12h.01"/></svg>`,
  Divers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
  Epargne: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  Abonnements: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zM15 5.5a3.3 3.3 0 0 0-3.3-3.3M15.5 15.5a3.3 3.3 0 0 0 3.3 3.3M15 15.5V5.5M15.5 15h5.5"/></svg>`,
  Vetements: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96V10a2 2 0 0 0 2 2h2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8h2a2 2 0 0 0 2-2V5.42a2 2 0 0 0-1.62-1.96z"/></svg>`,
  Cadeaux: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`,
  Banque: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/></svg>`,
  Impots: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  Investissement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  Auto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  Assurance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  Education: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  Famille: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  Perso: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  Travail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  Energie: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  Vacances: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 2H4l-1 1 3 2 2 3 1-1v-3l2-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`,
  Eau: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  Sport: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M6.7 6.7l10.6 10.6"/><path d="M6.7 17.3l10.6-10.6"/></svg>`,
  Tech: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  Meubles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18v3"/><path d="M20 18v3"/><path d="M19 13v3H5v-3"/><path d="M19 7a2 2 0 0 1 2 2v4H3V9a2 2 0 0 1 2-2h14z"/></svg>`,
  Animaux: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  Dons: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
};

export const KEYWORD_MAP: Record<string, string[]> = {
  Sante: [
    'Santé',
    'Pharmacie',
    'Médecin',
    'Doctolib',
    'Dentiste',
    'Opticien',
    'Mutuelle',
    'Médical',
    'Klesia',
  ],
  Logement: [
    'Logement',
    'Loyer',
    'Immobilier',
    'Copropriété',
    'Syndic',
    'Assurance Habitation',
    'Leroy Merlin',
    'Castorama',
    'Ikea',
    'But',
    'Conforama',
  ],
  Transport: [
    'Transport',
    'Train',
    'SNCF',
    'RATP',
    'Taxi',
    'Uber',
    'Péage',
    'Parking',
    'Carburant',
    'Essence',
    'TotalEnergies',
    'Shell',
    'Avia',
    'Eni',
  ],
  Alimentation: [
    'Alimentation',
    'Restaurant',
    'Resto',
    'Déjeuner',
    'Cantine',
    'Boulangerie',
    'Café',
    'Bar',
    'Nourriture',
    'Starbucks',
    'McDonald',
    'Burger King',
    'Deliveroo',
    'Uber Eats',
    'KFC',
    'Subway',
    'Vapiano',
    'Five Guys',
  ],
  Courses: [
    'Courses',
    'Supermarché',
    'Lidl',
    'Carrefour',
    'Leclerc',
    'Intermarché',
    'Monoprix',
    'Auchan',
    'Aldi',
    'Casino',
    'Franprix',
    'Super U',
  ],
  Services: [
    'Services',
    'Télécom',
    'Internet',
    'Mobile',
    'Orange',
    'Free',
    'SFR',
    'Bouygues',
    'Netflix',
    'Spotify',
    'Amazon Prime',
    'iCloud',
    'Fibre',
    'Téléphone',
    'Google Pay',
  ],
  Revenus: ['Revenus', 'Salaire', 'Virement reçu', 'Remboursement', 'Prime', 'Dividende'],
  Loisirs: [
    'Loisirs',
    'Cinéma',
    'Voyage',
    'Hôtel',
    'Culture',
    'Musique',
    'Streaming',
    'Fnac',
    'Cultura',
  ],
  Vacances: [
    'Vacances',
    'Voyage',
    'Hôtel',
    'Airbnb',
    'Booking',
    'Expedia',
    'Easyjet',
    'Air France',
  ],
  Abonnements: ['Abonnements', 'Mensuel', 'Recurring', 'Abonnement'],
  Auto: [
    'Auto',
    'Tesla',
    'Tesla Supercharger',
    'Supercharge',
    'Recharge',
    'Garage',
    'Réparation Auto',
    'Entretien Auto',
    'Voiture',
    'Norauto',
    'Midas',
  ],
  Energie: ['Energie', 'EDF', 'Électricité', 'Gaz', 'Engie', 'Total Direct Energie'],
  Epargne: [
    'Épargne',
    'Virement interne',
    'PEL',
    'Livret A',
    'Livret',
    'LDDS',
    'PEA',
    'Assurance Vie',
  ],
  Cadeaux: ['Cadeaux', 'Kdo', 'Cadeau', 'Anniversaire', 'Noel'],
  Sport: ['Sport', 'Salle de sport', 'Fitness', 'Foot', 'Tennis', 'Decathlon', 'Go Sport'],
  Eau: ['Eau', 'Suez', 'Veolia'],
  Tech: ['Tech', 'Apple', 'Amazon', 'Microsoft', 'LDLC', 'Darty', 'Boulanger'],
  Animaux: ['Animaux', 'Vétérinaire', 'Zooplus', 'Petfood'],
  Dons: ['Dons', 'Donation', 'Charité', 'Restos du coeur', 'Croix rouge'],
};

export const CATEGORY_RULES: Record<string, { color: string; icon: string }> = {
  Santé: { color: CAT.red, icon: ICONS.Sante },
  Logement: { color: CAT.orange, icon: ICONS.Logement },
  Transport: { color: CAT.blue, icon: ICONS.Transport },
  Alimentation: { color: CAT.green, icon: ICONS.Alimentation },
  Courses: { color: CAT.green, icon: ICONS.Courses },
  Services: { color: CAT.purple, icon: ICONS.Services },
  Revenus: { color: CAT.emerald, icon: ICONS.Revenus },
  Loisirs: { color: CAT.pink, icon: ICONS.Loisirs },
  Abonnements: { color: CAT.indigo, icon: ICONS.Abonnements },
  Auto: { color: CAT.blue, icon: ICONS.Auto },
  Energie: { color: CAT.yellow, icon: ICONS.Energie },
  Banque: { color: CAT.slate, icon: ICONS.Banque },
  Impots: { color: CAT.slate, icon: ICONS.Impots },
  Investissement: { color: CAT.indigo, icon: ICONS.Investissement },
  Education: { color: CAT.purple, icon: ICONS.Education },
  Famille: { color: CAT.orange, icon: ICONS.Famille },
  Perso: { color: CAT.pink, icon: ICONS.Perso },
  Travail: { color: CAT.blue, icon: ICONS.Travail },
  Assurance: { color: CAT.indigo, icon: ICONS.Assurance },
  Vetements: { color: CAT.pink, icon: ICONS.Vetements },
  Cadeaux: { color: CAT.red, icon: ICONS.Cadeaux },
  Divers: { color: token.labelSecondary, icon: ICONS.Divers },
  Épargne: { color: CAT.slate, icon: ICONS.Epargne },
  Tech: { color: CAT.blue, icon: ICONS.Tech },
  Meubles: { color: CAT.orange, icon: ICONS.Meubles },
  Animaux: { color: CAT.green, icon: ICONS.Animaux },
  Dons: { color: CAT.red, icon: ICONS.Dons },
};

export const AVAILABLE_COLORS = [
  { name: 'Rouge', value: CAT.red },
  { name: 'Orange', value: CAT.orange },
  { name: 'Jaune', value: CAT.yellow },
  { name: 'Vert', value: CAT.green },
  { name: 'Émeraude', value: CAT.emerald },
  { name: 'Bleu', value: CAT.blue },
  { name: 'Indigo', value: CAT.indigo },
  { name: 'Violet', value: CAT.purple },
  { name: 'Rose', value: CAT.pink },
  { name: 'Gris', value: CAT.slate },
];

/**
 * Retourne le style (couleur + icône) pour une catégorie donnée
 */
export function getCatStyle(cat: string) {
  if (!cat) return { color: token.labelSecondary, icon: ICONS.Divers, bg: token.separator };

  // 1. Chercher dans les préférences utilisateur (state.CATEGORY_STYLES)
  const userPrefs = (state as { CATEGORY_STYLES?: Record<string, { color: string; icon: string }> })
    .CATEGORY_STYLES?.[cat];
  if (userPrefs) {
    return {
      color: userPrefs.color,
      bg: categoryBg(userPrefs.color),
      icon: (ICONS as Record<string, string>)[userPrefs.icon] || ICONS.Divers,
    };
  }

  // 2. Chercher dans les règles par défaut
  const rule = CATEGORY_RULES[cat];
  if (rule) {
    return {
      color: rule.color,
      bg: categoryBg(rule.color),
      icon: rule.icon,
    };
  }

  // 3. Fallback par mot-clé
  for (const [iconName, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((k) => cat.toLowerCase().includes(k.toLowerCase()))) {
      const defaultColor = CATEGORY_RULES[iconName]?.color || token.labelSecondary;
      return {
        color: defaultColor,
        bg: categoryBg(defaultColor),
        icon: (ICONS as Record<string, string>)[iconName] ?? ICONS.Divers,
      };
    }
  }

  return { color: token.labelSecondary, bg: token.separator, icon: ICONS.Divers };
}

/**
 * Nettoie le libellé pour affichage
 */
export function formatLibelle(libelle: string) {
  if (!libelle) return '';
  let clean = libelle;

  // Enlever les préfixes communs de Linxo
  clean = clean.replace(/^(Virement [^:]+: |CB [^:]+: )/i, '');

  // Enlever les dates à la fin (ex: 20/05)
  clean = clean.replace(/ \d{2}\/\d{2}$/, '');

  return clean;
}

/**
 * Normalise une chaîne pour la recherche (lowercase, sans accents)
 */
export function normalizeSearchValue(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Génère des variantes de recherche pour un montant (avec/sans signe, virgule/point)
 */
export function buildAmountSearchValues(amount: number) {
  if (amount === undefined || amount === null) return [];
  const abs = Math.abs(amount).toFixed(2);
  const val = amount.toFixed(2);
  return [val, val.replace('.', ','), abs, abs.replace('.', ',')];
}
