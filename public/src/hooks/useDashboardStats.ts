import { useMemo } from 'react';
import { Transaction } from '../types/banking.types';

export interface DashboardStats {
  /** Somme des montants négatifs (dépenses), valeur ≤ 0. */
  totalDep: number;
  /** Somme des montants positifs (recettes), valeur ≥ 0. */
  totalRec: number;
  /** Solde net de la période (totalDep + totalRec). */
  solde: number;
}

/** Agrège dépenses / recettes / solde net d'une liste de transactions. Fonction pure. */
export const computeDashboardStats = (transactions: Transaction[]): DashboardStats => {
  let totalDep = 0;
  let totalRec = 0;
  for (const t of transactions) {
    const montant = Number(t.montant) || 0;
    if (montant < 0) totalDep += montant;
    else if (montant > 0) totalRec += montant;
  }
  return { totalDep, totalRec, solde: totalDep + totalRec };
};

/** Variante mémoïsée — ne recalcule que si la référence des transactions change. */
export const useDashboardStats = (transactions: Transaction[]): DashboardStats =>
  useMemo(() => computeDashboardStats(transactions), [transactions]);
