import type { Recurrence, Transaction } from '../types/banking.types';
import {
  computePeriodState,
  getApprovedTxIds,
  getDayOfMonth,
  type RecurrencePeriodState,
} from './recurrenceEngine';

/** A transaction settles at most one recurrence; recognized labels take priority. */
export function resolveRecurrencePeriods(
  recurrences: Recurrence[],
  periodKey: string,
  transactions: Transaction[],
  today: Date,
) {
  const active = recurrences.filter((recurrence) => recurrence.active);
  const ordered = [...active].sort((a, b) => getDayOfMonth(a) - getDayOfMonth(b));
  const claimed = getApprovedTxIds(active);
  const resolved = new Map<string, RecurrencePeriodState>();
  const weak: Recurrence[] = [];
  const claim = (state: RecurrencePeriodState) => {
    if (state.state === 'matched' && state.match?.tx.id) claimed.add(state.match.tx.id);
  };
  const available = transactions.filter((transaction) => transaction.bankStatus !== 'cancelled');
  for (const recurrence of ordered) {
    const state = computePeriodState(recurrence, periodKey, available, today, claimed);
    if (state.state === 'matched' && state.match?.confidence !== 'strong') {
      weak.push(recurrence);
      continue;
    }
    claim(state);
    resolved.set(recurrence.id, state);
  }
  for (const recurrence of weak) {
    const state = computePeriodState(recurrence, periodKey, available, today, claimed);
    claim(state);
    resolved.set(recurrence.id, state);
  }
  return resolved;
}
