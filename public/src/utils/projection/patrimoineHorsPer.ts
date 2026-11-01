import type { WealthTotals } from '../wealthSnapshot';

/**
 * Patrimoine de départ de la projection : comptes courants + épargne (livrets et placements
 * manuels) + bourse/investissements. Sont exclus le PER/retraite (bloqué jusqu'à la retraite,
 * modélisé à part via les pensions) et l'immobilier (non liquide). Reprend les totaux de
 * `computeWealthTotals`, déjà ventilés par nature. Null tant que le patrimoine charge.
 */
export function computePatrimoineHorsPer(
  totals: Pick<WealthTotals, 'courants' | 'epargne' | 'bourse'>,
  loading: boolean,
): number | null {
  if (loading) return null;
  return Math.round((totals.courants + totals.epargne + totals.bourse) * 100) / 100;
}
