import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from './firebase';
import type { BankSyncResult, BankSuggestion } from '../types/banking.types';

export async function bankCall<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const call = httpsCallable<Record<string, unknown>, T>(functions, name, { timeout: 540_000 });
  return (await call(data)).data;
}
export async function syncBanking(): Promise<BankSyncResult> {
  const result = await bankCall<BankSyncResult>('sync_banking');
  if (result.status !== 'running') return result;
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Synchronisation non finalisée. Consultez les connexions bancaires.'));
    }, 600_000);
    unsubscribe = onSnapshot(
      doc(db, 'bank_sync_runs', result.id),
      (snapshot) => {
        const value = snapshot.data() as BankSyncResult | undefined;
        if (value && value.status !== 'running') {
          clearTimeout(timer);
          unsubscribe();
          resolve({ ...value, id: result.id });
        }
      },
      (error) => {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      },
    );
  });
}
export const reconcileBanking = (
  suggestion: BankSuggestion,
  action: 'confirm' | 'distinct' | 'unlink',
  keepCanonicalId?: string,
) =>
  bankCall<{ status: string }>('banking_reconcile_action', {
    ...suggestion,
    action,
    keepCanonicalId,
  });
