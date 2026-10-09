import { useState, useCallback, useRef } from 'react';
import { useIntl } from 'react-intl';
import { toast } from '../lib/toast';
import { syncBanking } from '../services/banking-api';

/** Follow a persisted run, including successful imports with zero new rows. */
export const useSyncTransactions = () => {
  const { formatMessage: t } = useIntl();
  const [isSyncing, setIsSyncing] = useState(false);
  const active = useRef(false);
  const sync = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    setIsSyncing(true);
    toast.loading(t({ id: 'sync.loading' }), 'sync-loading');
    try {
      const result = await syncBanking();
      if (result.status === 'success')
        toast.success(t({ id: 'sync.success.completed' }, { count: result.imported ?? 0 }), 6000);
      else if (result.status === 'partial') toast.error(t({ id: 'sync.partial' }), 6000);
      else toast.error(t({ id: 'sync.error.failed' }), 6000);
    } catch (error) {
      toast.error(
        t(
          { id: 'sync.error.generic' },
          { message: error instanceof Error ? error.message : String(error) },
        ),
        6000,
      );
    } finally {
      toast.dismiss('sync-loading');
      active.current = false;
      setIsSyncing(false);
    }
  }, [t]);
  return { sync, isSyncing };
};
