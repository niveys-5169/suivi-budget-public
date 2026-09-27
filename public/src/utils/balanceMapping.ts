import { BaseBalance } from '../types/balances';
import type { Transaction } from '../types/banking.types';

/**
 * Maps a Firestore document or data object to a Balance interface.
 * Centralizes the logic for compatibility between legacy 'solde' and new 'current_balance',
 * and handles fallback for status, source, and timestamps.
 */
export const mapFirestoreBalance = <T extends BaseBalance>(
  doc: { id?: string; data?: () => Record<string, unknown> } | Record<string, unknown>,
): T => {
  const docObj = doc as { id?: string; data?: () => Record<string, unknown> };
  const data = (typeof docObj.data === 'function' ? docObj.data() : doc) as Record<string, unknown>;
  const id = docObj.id || (data as { id: string }).id;

  return {
    ...data,
    id,
    current_balance:
      data.current_balance !== undefined ? data.current_balance : (data.solde as number) || 0,
    status: data.status || 'reconciled',
    source: data.source || 'manual',
    source_timestamp: data.source_timestamp || data.lastUpdated || null,
    is_savings: data.is_savings || false,
  } as unknown as T;
};

export const buildBalanceMismatchFingerprint = (
  r: BaseBalance & {
    ecart?: number;
    previousSolde?: number;
    linxoDelta?: number;
    computedSolde?: number;
  },
) => {
  const solde = r.current_balance !== undefined ? r.current_balance : (r.solde ?? '');
  return [
    r.status || '',
    Number(r.ecart ?? ''),
    Number(r.previousSolde ?? ''),
    Number(r.linxoDelta ?? ''),
    Number(r.computedSolde ?? ''),
    Number(solde),
  ].join('|');
};

/**
 * Solde dont le contrôle de cohérence demande une revue. Même règle que
 * `BalanceCard` : `pending_review`, ou `discrepancy_unresolved` non accepté
 * (empreinte d'acquittement différente de l'écart courant).
 */
export const needsBalanceReview = (
  r: Parameters<typeof buildBalanceMismatchFingerprint>[0] & { mismatchAckFingerprint?: string },
): boolean => {
  if (r.status === 'pending_review') return true;
  return (
    r.status === 'discrepancy_unresolved' &&
    r.mismatchAckFingerprint !== buildBalanceMismatchFingerprint(r)
  );
};

/**
 * Mouvements du compte arrivés APRÈS le mail qui a fourni le solde stocké,
 * recalculés en direct. Même fenêtre que le contrôle de cohérence de l'import
 * (emailDate strictement postérieure ; transactions sans emailDate ignorées).
 * Non nul : des opérations sont remontées sans que le solde suive — typiquement
 * un solde non reconnu par le parser. `null` si le solde n'a pas d'emailDate.
 */
export const mouvementsDepuisSolde = (
  balance: Pick<BaseBalance, 'compte' | 'emailDate'>,
  transactions: Pick<Transaction, 'compte' | 'montant' | 'emailDate'>[],
): { total: number; count: number } | null => {
  const depuis = balance.emailDate?.toDate?.();
  if (!depuis) return null;
  let cents = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.compte !== balance.compte || !tx.emailDate || tx.emailDate <= depuis) continue;
    cents += Math.round(tx.montant * 100);
    count += 1;
  }
  return { total: cents / 100, count };
};
