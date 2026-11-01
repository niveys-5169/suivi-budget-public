/**
 * Représente une valeur de date potentielle provenant de Firestore ou d'une chaîne ISO.
 */
export type DateInput =
  | Date
  | string
  | number
  | null
  | undefined
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number };

/**
 * Convertit une valeur hétérogène en instance Date valide.
 */
export function parseDateInput(value: DateInput): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const milliseconds = value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
    const converted = new Date(milliseconds);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  const converted = new Date(value as string | number);
  return Number.isNaN(converted.getTime()) ? null : converted;
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Lit une date calendaire `YYYY-MM-DD` comme minuit LOCAL, à partir de ses
 * composantes (jamais d'aller-retour UTC) : `new Date('2026-10-31')` vaut minuit
 * UTC, donc la veille dès que le fuseau est négatif. Une date inexistante
 * (`2026-02-31`) donne une Date invalide au lieu de déborder sur mars.
 * Toute autre chaîne (horodatage ISO complet avec heure/offset) garde la
 * sémantique de `new Date(str)`.
 */
export function parseCalendarDate(str: string): Date {
  const match = CALENDAR_DATE.exec(str);
  if (!match) return new Date(str);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : new Date(NaN);
}

/**
 * Clé calendaire `YYYY-MM-DD` du jour LOCAL de `d` (à l'inverse de
 * `toISOString().slice(0, 10)`, qui donne le jour UTC : la veille / le lendemain
 * autour de minuit).
 */
export function toCalendarKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Retourne le nombre de jours entre deux dates (arrondi à l'entier le plus proche).
 */
export function diffInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Formate une clé de mois `YYYY-MM` en libellé localisé.
 */
export function formatMonthKey(monthKey: string, locale = 'fr-FR'): string {
  const [year = NaN, month = NaN] = String(monthKey || '')
    .split('-')
    .map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  return new Date(year, month - 1).toLocaleDateString(locale, {
    month: 'short',
    year: '2-digit',
  });
}

/**
 * Retourne le mois d'affectation d'une transaction (YYYY-MM).
 * Priorité au champ `moisAffectation`, sinon utilise les 7 premiers caractères de `date`.
 */
export function getAssignedMonthKey(
  tx?: { moisAffectation?: string; date?: string } | null,
): string {
  const assigned = String(tx?.moisAffectation || '').trim();
  if (/^\d{4}-\d{2}$/.test(assigned)) return assigned;
  return String(tx?.date || '').slice(0, 7);
}

export const toDate = parseDateInput;

/**
 * Calcule la progression théorique (0-100) attendue à date si la consommation
 * du budget suivait un rythme parfaitement linéaire sur la période sélectionnée.
 *
 * Pour un mois/année déjà entièrement passé (navigation vers le passé via le
 * sélecteur de mois), la période est considérée intégralement écoulée (100).
 */
export function getExpectedPaceProgress(
  periodMode: 'monthly' | 'annual',
  monthKey: string,
  today: Date = new Date(),
): number {
  const [year = NaN, month = NaN] = String(monthKey || '')
    .split('-')
    .map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;

  if (periodMode === 'monthly') {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    if (!isCurrentMonth) return 100;
    const daysInMonth = new Date(year, month, 0).getDate();
    return Math.min(100, (today.getDate() / daysInMonth) * 100);
  }

  const isCurrentYear = year === today.getFullYear();
  if (!isCurrentYear) return 100;
  const startOfYear = new Date(year, 0, 1);
  const daysInYear = diffInDays(startOfYear, new Date(year, 11, 31)) + 1;
  const daysPassed = diffInDays(startOfYear, today) + 1;
  return Math.min(100, (daysPassed / daysInYear) * 100);
}
