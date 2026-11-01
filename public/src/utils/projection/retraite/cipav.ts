/** Retraite Cipav (libéral) : points proratisés au BNC (③b lignes 94-95). */

/** Points acquis sur une année : points de référence × BNC ÷ BNC de référence, jamais négatifs. */
export function pointsCipavAnnee(
  bnc: number,
  pointsReference: number,
  bncReference: number,
): number {
  return bncReference > 0 ? (pointsReference * Math.max(0, bnc)) / bncReference : 0;
}

/** Pension mensuelle brute : points × valeur du point ÷ 12. */
export function pensionCipav(points: number, valeurPoint: number): number {
  return (points * valeurPoint) / 12;
}
