import { useState, useCallback, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useGlobalData } from '../context/GlobalDataContext';
import { useTransactionContext } from '../context/TransactionContext';
import type { AccountBalance } from '../types/balances';

import { formatCurrency } from '../lib/formatters';
import { toast } from '../lib/toast';
import { triggerGitHubWorkflow } from '../services/firebase-api';

const LOADING_TOAST_ID = 'sync-loading';
const WARNING_TOAST_ID = 'sync-discrepancy';

// `updatedAt` est un Firestore Timestamp camelCase écrit par
// `sauvegarder_soldes_comptes` (functions/firebase_db.py:327). On NE PAS
// utiliser `source_timestamp` : il est mappé depuis `lastUpdated` qui n'est
// pas écrit côté backend, donc null pour les imports Linxo.
const getUpdatedAtMillis = (b: AccountBalance): number => {
  const ts = (b as unknown as { updatedAt?: { toMillis?: () => number } }).updatedAt;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
};

async function triggerImport(): Promise<'success' | 'error'> {
  const result = await triggerGitHubWorkflow('import-linxo');
  const status = (result as { status?: string } | null)?.status;
  return status === 'success' ? 'success' : 'error';
}

/** Déclenche la synchronisation des transactions depuis les sources bancaires externes. */
export const useSyncTransactions = () => {
  const { formatMessage: t } = useIntl();
  const [isSyncing, setIsSyncing] = useState(false);
  const { accountBalances } = useGlobalData();
  const { transactions } = useTransactionContext();

  const accountBalancesRef = useRef<AccountBalance[]>(accountBalances);
  useEffect(() => {
    accountBalancesRef.current = accountBalances;
  }, [accountBalances]);

  const txCountRef = useRef<number>(transactions.length);
  useEffect(() => {
    txCountRef.current = transactions.length;
  }, [transactions]);

  // Surveillance post-import : renseignée par `watchForNewTransactions`, elle est
  // consommée par l'effet ci-dessous qui réagit à chaque nouveau snapshot de
  // transactions (en remplacement de l'ancien bus `budget-data-updated`).
  const watchRef = useRef<{
    previousCount: number;
    beforeSync: Map<string, number>;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const stopWatching = useCallback(() => {
    if (watchRef.current) {
      clearTimeout(watchRef.current.timer);
      watchRef.current = null;
    }
  }, []);

  useEffect(() => {
    const watch = watchRef.current;
    if (!watch) return;

    const current = transactions.length;
    if (current > watch.previousCount) {
      const n = current - watch.previousCount;
      toast.success(t({ id: 'sync.success.imported' }, { count: n }), 6000);
      stopWatching();
    }

    const newPendings = accountBalancesRef.current.filter((b) => {
      const prev = watch.beforeSync.get(b.compte) ?? 0;
      return getUpdatedAtMillis(b) > prev && b.status === 'pending_review';
    });
    if (newPendings.length > 0) {
      const lines = newPendings
        .map((b) =>
          t(
            { id: 'sync.warning.discrepancy.account' },
            {
              compte: b.compte,
              ecart: formatCurrency(Number((b as { ecart?: number }).ecart ?? 0)),
            },
          ),
        )
        .join('\n');
      toast.error(`${t({ id: 'sync.warning.discrepancy.title' })}\n${lines}`, 0, WARNING_TOAST_ID);
    }
  }, [transactions, t, stopWatching]);

  // Arrête toute surveillance en cours au démontage.
  useEffect(() => stopWatching, [stopWatching]);

  const watchForNewTransactions = useCallback(
    (previousCount: number, beforeSync: Map<string, number>) => {
      stopWatching();
      // Stop watching after 3 min — GitHub Action can take time
      const timer = setTimeout(stopWatching, 180_000);
      watchRef.current = { previousCount, beforeSync, timer };
    },
    [stopWatching],
  );

  const sync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    const previousCount = txCountRef.current;
    const beforeSync = new Map<string, number>(
      accountBalancesRef.current.map((b) => [b.compte, getUpdatedAtMillis(b)]),
    );

    // Persistent loading toast
    toast.loading(t({ id: 'sync.loading' }), LOADING_TOAST_ID);

    try {
      const result = await triggerImport();
      toast.dismiss(LOADING_TOAST_ID);

      if (result === 'success') {
        toast.info(t({ id: 'sync.success.dispatched' }), 6000);
        watchForNewTransactions(previousCount, beforeSync);
      } else {
        toast.error(t({ id: 'sync.error.failed' }), 6000);
      }
    } catch (err) {
      toast.dismiss(LOADING_TOAST_ID);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t({ id: 'sync.error.generic' }, { message: msg }), 6000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, watchForNewTransactions, t]);

  return { sync, isSyncing };
};
