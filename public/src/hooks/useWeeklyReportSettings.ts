import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import { withRetry } from '../utils/withRetry';
import { toast } from '../lib/toast';
import { WeeklyReportConfig } from '../types/banking.types';

const DEFAULT_CONFIG: WeeklyReportConfig = {
  enabled: true,
  recipients: [],
  dayOfWeek: 5,
  sendHour: 18,
  includeCheckingBalances: true,
  includeSavingsBalances: false,
  includeWeeklyExpenses: true,
  includeBudgetAlerts: true,
  budgetWarningThreshold: 80,
};

export const useWeeklyReportSettings = () => {
  const [config, setConfig] = useState<WeeklyReportConfig>(DEFAULT_CONFIG);
  // Sans Firestore configuré, rien à charger.
  const [loading, setLoading] = useState(Boolean(db));
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!db) return;
    const configDoc = doc(db, 'config', 'weekly_report');
    const unsub = onSnapshot(
      configDoc,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            enabled: data.enabled !== false,
            recipients: Array.isArray(data.recipients) ? data.recipients : [],
            dayOfWeek: typeof data.dayOfWeek === 'number' ? data.dayOfWeek : 5,
            sendHour: typeof data.sendHour === 'number' ? data.sendHour : 18,
            includeCheckingBalances: data.includeCheckingBalances !== false,
            includeSavingsBalances: data.includeSavingsBalances === true,
            includeWeeklyExpenses: data.includeWeeklyExpenses !== false,
            includeBudgetAlerts: data.includeBudgetAlerts !== false,
            budgetWarningThreshold:
              typeof data.budgetWarningThreshold === 'number' ? data.budgetWarningThreshold : 80,
            lastSentAt: data.lastSentAt,
            lastStatus: data.lastStatus,
            lastError: data.lastError,
            lastRecipients: Array.isArray(data.lastRecipients) ? data.lastRecipients : [],
            updatedAt: data.updatedAt,
          });
        } else {
          setConfig(DEFAULT_CONFIG);
        }
        setLoading(false);
      },
      (err) => {
        console.error('[useWeeklyReportSettings] Erreur écoute config/weekly_report:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const updateConfig = useCallback(async (patch: Partial<WeeklyReportConfig>) => {
    if (!db) return;
    const configDoc = doc(db, 'config', 'weekly_report');
    await withRetry(() =>
      setDoc(configDoc, { ...patch, updatedAt: serverTimestamp() }, { merge: true }),
    );
  }, []);

  const sendNow = useCallback(async () => {
    setIsSending(true);
    try {
      const callable = httpsCallable<
        Record<string, never>,
        { status: string; recipients: string[] }
      >(functions, 'send_weekly_recap_email');
      const res = await callable({});
      const rec = res.data.recipients?.join(', ');
      toast.success(
        rec ? `Email récapitulatif envoyé à ${rec}` : 'Email récapitulatif envoyé avec succès',
      );
    } catch (err) {
      console.error('Erreur send_weekly_recap_email:', err);
      toast.error(`Échec d'envoi : ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsSending(false);
    }
  }, []);

  return {
    config,
    loading,
    isSending,
    updateConfig,
    sendNow,
  };
};
