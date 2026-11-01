/**
 * Arithmétique de dates en nombre de jours depuis le 01/01/1970 (entiers ou fractions de jour).
 * Évite tout `Date` : le classeur raisonne en numéros de série Excel (EDATE, différences de dates).
 */

/** Numéro de jour d'une date civile (algorithme « days from civil », mois 1 à 12). */
export function dayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Date civile `{ year, month, day }` d'un numéro de jour (partie entière). */
export function civilFromDay(value: number): { year: number; month: number; day: number } {
  const z = Math.floor(value) + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Numéro de jour d'une date `YYYY-MM-DD` (ou du 1er jour d'un mois `YYYY-MM`). */
export function parseDay(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return dayNumber(year, month, day);
}

/** Excel EDATE : décale de `months` mois en conservant le jour (borné à la fin du mois d'arrivée). */
export function edate(value: number, months: number): number {
  const { year, month, day } = civilFromDay(value);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const lastDay = dayNumber(targetYear, targetMonth + 1, 1) - dayNumber(targetYear, targetMonth, 1);
  return dayNumber(targetYear, targetMonth, Math.min(day, lastDay));
}

/** Année civile d'un numéro de jour. */
export function yearOfDay(value: number): number {
  return civilFromDay(value).year;
}

/** Mois `YYYY-MM` d'un numéro de jour. */
export function monthOfDay(value: number): string {
  const { year, month } = civilFromDay(value);
  return `${year}-${String(month).padStart(2, '0')}`;
}
