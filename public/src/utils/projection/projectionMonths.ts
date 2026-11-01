import type { ProjectionMonth } from '../../types/banking.types';

/** Rang absolu d'un mois 'YYYY-MM' (année × 12 + mois − 1). */
export function monthIndex(mois: ProjectionMonth): number {
  const [annee = 0, numero = 1] = mois.split('-').map(Number);
  return annee * 12 + numero - 1;
}

export function monthFromIndex(index: number): ProjectionMonth {
  const annee = Math.floor(index / 12);
  const numero = (index % 12) + 1;
  return `${annee}-${String(numero).padStart(2, '0')}`;
}

export function yearOf(mois: ProjectionMonth): number {
  return Math.floor(monthIndex(mois) / 12);
}

/** Mois calendaire, de 1 à 12. */
export function monthOfYear(mois: ProjectionMonth): number {
  return (monthIndex(mois) % 12) + 1;
}

/** Liste des mois de `debut` à `fin` inclus (vide si `fin` < `debut`). */
export function monthRange(debut: ProjectionMonth, fin: ProjectionMonth): ProjectionMonth[] {
  const mois: ProjectionMonth[] = [];
  for (let i = monthIndex(debut); i <= monthIndex(fin); i += 1) mois.push(monthFromIndex(i));
  return mois;
}

/** Nombre de mois entre `de` (exclu) et `a` (inclus) ; négatif si `a` précède `de`. */
export function monthsBetween(de: ProjectionMonth, a: ProjectionMonth): number {
  return monthIndex(a) - monthIndex(de);
}
