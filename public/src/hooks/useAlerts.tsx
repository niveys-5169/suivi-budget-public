import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useBudget } from './useBudget';
import { useTransactionContext } from '../context/TransactionContext';
import { useGlobalData } from '../context/GlobalDataContext';
import { computeAlerts } from '../utils/computeAlerts';
import type { Alert } from '../types/banking.types';
import { useBankingData } from './useBankingData';
import { computeBankingAlerts } from '../utils/computeBankingAlerts';

const STORAGE_KEY = 'readAlertKeys';

// Les alertes sont recalculées à chaque rendu : on mémorise les clés lues.
// La clé inclut `desc` (mois, montants) pour qu'une alerte qui change de
// contenu redevienne non lue.
const alertKey = (a: Alert) => (a.episodeKey ? `${a.id}|${a.episodeKey}` : `${a.id}|${a.desc}`);

const currentMonthKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const listeners = new Set<() => void>();
let readKeys: string[] | null = null;

const loadReadKeys = (): string[] => {
  if (readKeys) return readKeys;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    readKeys = Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === 'string')
      : [];
  } catch {
    readKeys = [];
  }
  return readKeys;
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const markRead = (keys: string[]) => {
  const current = loadReadKeys();
  const next = [...new Set([...current, ...keys])];
  if (next.length === current.length) return;
  readKeys = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible : l'état lu reste valable pour la session
  }
  listeners.forEach((l) => l());
};

/** Calcule les alertes actives (dépassements budgétaires, récurrences en
 * retard, hausses de prix) à partir des données du mois courant.
 * `errorCount` compte toutes les erreurs ; `unreadErrorCount` seulement celles
 * pas encore lues (pastille de la cloche). */
export const useAlerts = (): {
  alerts: Alert[];
  errorCount: number;
  unreadErrorCount: number;
  markAllRead: () => void;
} => {
  const { budgets } = useBudget();
  const { transactions } = useTransactionContext();
  const { recurrences } = useGlobalData();
  // Mois réel, indépendant du mois sélectionné dans l'UI (persisté en localStorage) :
  // sinon les alertes restent figées sur un ancien mois.
  const monthKey = currentMonthKey();
  const { connections, reports, now } = useBankingData();

  const alerts = useMemo(
    () => [
      ...computeBankingAlerts(connections, reports, now),
      ...computeAlerts({
        budgets,
        transactions,
        currentMonthKey: monthKey,
        recurrences,
      }),
    ],
    [budgets, transactions, monthKey, recurrences, connections, reports, now],
  );

  const read = useSyncExternalStore(subscribe, loadReadKeys);

  const errorCount = useMemo(() => alerts.filter((a) => a.type === 'error').length, [alerts]);
  const unreadErrorCount = useMemo(
    () => alerts.filter((a) => a.type === 'error' && !read.includes(alertKey(a))).length,
    [alerts, read],
  );

  const markAllRead = useCallback(() => markRead(alerts.map(alertKey)), [alerts]);

  return { alerts, errorCount, unreadErrorCount, markAllRead };
};
