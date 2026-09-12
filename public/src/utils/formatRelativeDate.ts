import { parseDateInput, DateInput } from './date';

/**
 * Formate une date en libellé relatif en français :
 * - Aujourd'hui
 * - Hier
 * - Il y a N j (si <= 7 jours)
 * - DD/MM/YYYY (si plus ancien)
 */
export function formatRelativeDate(value: DateInput): string {
  const date = parseDateInput(value);
  if (!date) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = startOfToday.getTime() - startOfDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Aujourd'hui";
  } else if (diffDays === 1) {
    return 'Hier';
  } else if (diffDays > 1 && diffDays <= 7) {
    return `Il y a ${diffDays} j`;
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
