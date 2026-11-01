import type { ProjectionMonth } from '../../types/banking.types';
import { yearlyAmounts } from './importPhases';

/** Ligne mensuelle d'un onglet Calc : cash après PAS des deux personnes. */
export interface CashLine {
  mois: ProjectionMonth;
  cash1: number;
  cash2: number;
}

/** Cash moyen par année à partir de `debut` (tous les mois comptent : le 1er mois d'une pension est complet). */
export function pensionAmounts(
  lines: CashLine[],
  debut: ProjectionMonth | undefined,
  personne: 1 | 2,
): Record<string, number> | undefined {
  if (!debut) return undefined;
  const points = lines
    .filter((l) => l.mois >= debut)
    .map((l) => ({ mois: l.mois, value: personne === 1 ? l.cash1 : l.cash2 }));
  return points.length > 0 ? yearlyAmounts(points, false) : undefined;
}
