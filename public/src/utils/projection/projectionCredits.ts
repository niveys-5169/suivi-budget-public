import type { ProjectionCreditResolu, ProjectionMonth } from '../../types/banking.types';
import { monthIndex, monthsBetween } from './projectionMonths';

/** Valeur actuelle de `n` mensualités au taux mensuel `tauxMensuel` (0 = somme simple). */
export function presentValue(tauxMensuel: number, n: number, mensualite: number): number {
  if (n <= 0) return 0;
  if (tauxMensuel === 0) return mensualite * n;
  return (mensualite * (1 - Math.pow(1 + tauxMensuel, -n))) / tauxMensuel;
}

/** Mensualité due ce mois-ci : jusqu'à `fin` et jusqu'au mois du remboursement anticipé inclus. */
export function creditPayment(credit: ProjectionCreditResolu, mois: ProjectionMonth): number {
  const m = monthIndex(mois);
  if (credit.fin !== undefined && m > monthIndex(credit.fin)) return 0;
  if (credit.remboursementAnticipe && m > monthIndex(credit.remboursementAnticipe.mois)) return 0;
  return credit.mensualite;
}

/**
 * Sortie de capital au mois du remboursement anticipé : capital restant dû (valeur actuelle des
 * mensualités entre ce mois exclu et `fin` inclus) + frais. Sans `fin`, on prend la fin de l'horizon.
 */
export function earlyRepayment(
  credit: ProjectionCreditResolu,
  mois: ProjectionMonth,
  finHorizon: ProjectionMonth,
): number {
  const anticipe = credit.remboursementAnticipe;
  if (!anticipe || anticipe.mois !== mois) return 0;
  const n = Math.max(0, monthsBetween(mois, credit.fin ?? finHorizon));
  const tauxMensuel = credit.tauxAnnuel / 100 / 12;
  return presentValue(tauxMensuel, n, credit.mensualite) + (anticipe.frais ?? 0);
}
