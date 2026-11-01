import type { ProjectionMonth } from '../../types/banking.types';
import { differencePhase, yearlyAmounts, type MonthPoint } from './importPhases';

/** Ligne mensuelle d'un onglet Calc : cash après PAS des deux personnes. */
export interface CashLine {
  mois: ProjectionMonth;
  cash1: number;
  cash2: number;
}

export function cash2Points(lines: CashLine[]): MonthPoint[] {
  return lines.map((l) => ({ mois: l.mois, value: l.cash2 }));
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

/** Phase « Écart PAS personne 2 » d'un scénario par rapport au cash 2 du premier onglet. */
export function ecartPersonne2(
  scenarioId: string,
  personneId: string,
  lines: CashLine[],
  reference: MonthPoint[],
) {
  return differencePhase(
    `${scenarioId}-ecart-p2`,
    personneId,
    'Écart PAS personne 2',
    cash2Points(lines),
    reference,
  );
}
