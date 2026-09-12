import type { Alert, Recurrence, Transaction } from '../types/banking.types';
import { getPeriodKey, computePeriodState, getApprovedTxIds } from './recurrenceEngine';

interface TxLike {
  id?: string;
  libelle?: string;
  categorie?: string;
  category?: string;
  montant?: number;
  amount?: number;
  moisAffectation?: string;
  date?: string;
}

interface BudgetLike {
  id: string;
  categorie: string;
  montant: number;
  actif?: boolean;
}

interface ComputeAlertsInput {
  budgets: BudgetLike[];
  transactions: TxLike[];
  currentMonthKey: string;
  recurrences: Recurrence[];
}

export function computeAlerts({
  budgets,
  transactions,
  currentMonthKey,
  recurrences,
}: ComputeAlertsInput): Alert[] {
  const alerts: Alert[] = [];
  const prevMonthKey = getPrevMonthKey(currentMonthKey);

  // Budget alerts — computed on the previous (completed) month to avoid false positives mid-month
  const prevTx = transactions.filter(
    (t) => (t.moisAffectation || t.date || '').slice(0, 7) === prevMonthKey,
  );

  for (const b of budgets) {
    if (b.actif === false || !b.montant) continue;

    const spent = prevTx
      .filter((t) => (t.categorie ?? '') === b.categorie && (t.montant ?? 0) < 0)
      .reduce((s, t) => s + Math.abs(t.montant ?? 0), 0);

    const ratio = spent / b.montant;

    if (ratio >= 1) {
      alerts.push({
        id: `budget-over-${b.id}`,
        type: 'error',
        title: 'Budget dépassé',
        desc: `Enveloppe "${b.categorie}" dépassée de ${(spent - b.montant).toFixed(0)} € en ${formatMonth(prevMonthKey)}`,
        time: 'Mois passé',
      });
    } else if (ratio >= 0.8) {
      alerts.push({
        id: `budget-watch-${b.id}`,
        type: 'warning',
        title: 'Attention budget',
        desc: `${Math.round(ratio * 100)} % de l'enveloppe "${b.categorie}" consommé en ${formatMonth(prevMonthKey)}`,
        time: 'Mois passé',
      });
    }
  }

  // Récurrences en retard et hausses de prix (mois courant)
  const today = new Date();
  const currentMonthTx = transactions.filter(
    (t) => (t.moisAffectation || t.date || '').slice(0, 7) === currentMonthKey,
  ) as Transaction[];

  const excludeTxIds = getApprovedTxIds(recurrences);

  for (const r of recurrences.filter((rec) => rec.active)) {
    const periodKey = getPeriodKey(`${currentMonthKey}-01`);
    const result = computePeriodState(r, periodKey, currentMonthTx, today, excludeTxIds);

    if (result.state === 'overdue') {
      alerts.push({
        id: `recurring-overdue-${r.id}`,
        type: 'warning',
        title: 'Récurrence en retard',
        desc: `"${r.label}" attendue le ${result.occurrenceDate.split('-').reverse().join('/')}, toujours pas pointée`,
        time: 'À vérifier',
        actionTab: 'recurring',
      });
    } else if (result.state === 'matched') {
      // Une hausse n'est signalée que sur un rattachement automatique (pas une
      // approbation manuelle, où l'utilisateur a déjà vu et validé le montant).
      const paidAmount = Math.abs(result.effectiveAmount);
      const expected = Math.abs(r.expectedAmount);
      if (expected > 0 && paidAmount > expected * 1.1) {
        alerts.push({
          id: `recurring-price-${r.id}`,
          type: 'info',
          title: 'Hausse de prix détectée',
          desc: `"${r.label}" : ${paidAmount.toFixed(2)} € au lieu de ${expected.toFixed(2)} € attendus`,
          time: 'Ce mois',
          actionTab: 'recurring',
        });
      }
    }
  }

  return alerts;
}

function getPrevMonthKey(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(monthKey: string): string {
  const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
  return new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
