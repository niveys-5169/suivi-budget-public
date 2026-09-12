/**
 * Référentiel de branding des banques pour l'affichage des logos/pastilles.
 *
 * On n'embarque pas les logos officiels (droits d'usage) : on affiche les
 * initiales de la banque dans une pastille teintée de sa couleur de marque, avec
 * repli doré (thème AURUM) pour les banques inconnues. La détection se fait par
 * sous-chaîne sur le nom de compte/banque (insensible à la casse).
 */

export interface BankBranding {
  /** Libellé court affiché dans la pastille (2-4 caractères). */
  short: string;
  /** Couleur d'accent (hex) de la marque. */
  color: string;
}

/** Repli AURUM pour toute banque non répertoriée. */
const DEFAULT_BRANDING: BankBranding = { short: '', color: '#D4AF37' };

/** Table de correspondance sous-chaîne → branding. Ordre = priorité. */
const BRANDING_TABLE: { match: string; branding: BankBranding }[] = [
  { match: 'bforbank', branding: { short: 'BFB', color: '#E4002B' } },
  { match: 'lcl', branding: { short: 'LCL', color: '#005EB8' } },
  { match: 'boursorama', branding: { short: 'BRS', color: '#EC6608' } },
  { match: 'bourso', branding: { short: 'BRS', color: '#EC6608' } },
  { match: 'crédit agricole', branding: { short: 'CA', color: '#00875A' } },
  { match: 'credit agricole', branding: { short: 'CA', color: '#00875A' } },
  { match: 'revolut', branding: { short: 'RVT', color: '#0666EB' } },
  { match: 'n26', branding: { short: 'N26', color: '#48AC98' } },
  { match: 'société générale', branding: { short: 'SG', color: '#E60028' } },
  { match: 'societe generale', branding: { short: 'SG', color: '#E60028' } },
  { match: 'bnp', branding: { short: 'BNP', color: '#00915A' } },
  { match: 'trade republic', branding: { short: 'TR', color: '#000000' } },
];

/** Initiales de repli à partir du nom (2 premières lettres alphabétiques). */
function fallbackInitials(name: string): string {
  const letters = name.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return (letters.slice(0, 2) || '?').toUpperCase();
}

/** Retourne le branding d'une banque à partir de son nom de compte. */
export function getBankBranding(name: string): BankBranding {
  const n = (name || '').toLowerCase();
  for (const { match, branding } of BRANDING_TABLE) {
    if (n.includes(match)) return branding;
  }
  return { ...DEFAULT_BRANDING, short: fallbackInitials(name) };
}
