import React, { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  GitCompareArrows,
  History,
  LucideIcon,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { db, functions } from '../services/firebase';
import { AccountBalance, Discrepancy, BaseBalance } from '../types/balances';
import { fmt } from '../utils/format';
import {
  buildConfirmReconciliationPayload,
  buildManualOverridePayload,
  buildSourceChoicePayload,
} from '../utils/reconciliationActions';

interface HistoryEntry {
  id: string;
  account_id: string;
  balance_value: number;
  timestamp: Timestamp;
  event_type: string;
  source: string;
  previous_balance?: number;
  user_id?: string;
  discrepancy_details?: Record<string, unknown>;
}

interface EventMeta {
  label: { main: string; sub?: string };
  color: string;
  badgeBg: string;
  Icon: LucideIcon;
}

const EVENT_META: Record<string, EventMeta> = {
  imported_gmail: {
    label: { main: 'Import automatique', sub: 'Gmail' },
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10',
    Icon: Upload,
  },
  reconciled_user_choice: {
    label: { main: 'Rapprochement', sub: 'Source choisie' },
    color: 'text-positive',
    badgeBg: 'bg-positive/10',
    Icon: CheckCircle2,
  },
  reconciled_manual_override: {
    label: { main: 'Correction manuelle' },
    color: 'text-warning',
    badgeBg: 'bg-warning/10',
    Icon: Edit2,
  },
  reconciled_manual_confirm: {
    label: { main: 'Solde confirmé' },
    color: 'text-positive',
    badgeBg: 'bg-positive/10',
    Icon: CheckCircle2,
  },
  discrepancy_acknowledged: {
    label: { main: 'Écart reconnu' },
    color: 'text-warning',
    badgeBg: 'bg-warning/10',
    Icon: AlertCircle,
  },
  reconciled_auto: {
    label: { main: 'Rapprochement automatique' },
    color: 'text-positive',
    badgeBg: 'bg-positive/10',
    Icon: CheckCircle2,
  },
};

const getEventMeta = (eventType: string): EventMeta => {
  return (
    EVENT_META[eventType] || {
      label: { main: eventType.replace(/_/g, ' ') },
      color: 'text-label-secondary',
      badgeBg: 'bg-white/5',
      Icon: Clock,
    }
  );
};

interface BalanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountBalance | null;
  onOpenReconciliation?: () => void;
}

const pickBalanceValue = (account: AccountBalance | null) =>
  typeof account?.current_balance === 'number' ? account.current_balance : account?.solde;

export const BalanceHistoryModal: React.FC<BalanceHistoryModalProps> = ({
  isOpen,
  onClose,
  account,
  onOpenReconciliation,
}) => {
  const { formatMessage: t, formatDate } = useIntl();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const accountId = account?.id || '';
  const accountName = account?.compte || accountId || 'Compte';
  const unresolvedDiscrepancies =
    account?.discrepancies?.filter((d) => d.status === 'unresolved') || [];

  const auditGap =
    typeof (account as BaseBalance & { ecart?: number })?.ecart === 'number'
      ? (account as BaseBalance & { ecart?: number }).ecart
      : null;
  const hasAuditGap = typeof auditGap === 'number' && Math.abs(auditGap || 0) > 0.01;

  const PAGE_SIZE = 3;

  const fetchHistory = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null = null) => {
      if (!accountId) return;
      setLoading(true);
      if (!cursor) setError(null);

      try {
        const historyRef = collection(db, 'account_balance_history');
        const q = cursor
          ? query(
              historyRef,
              where('account_id', '==', accountId),
              orderBy('timestamp', 'desc'),
              startAfter(cursor),
              limit(PAGE_SIZE),
            )
          : query(
              historyRef,
              where('account_id', '==', accountId),
              orderBy('timestamp', 'desc'),
              limit(PAGE_SIZE),
            );

        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as HistoryEntry);
        setHistory((prev) => (cursor ? [...prev, ...entries] : entries));
        setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (err) {
        console.error('Error fetching balance history:', err);
        setError(t({ id: 'balanceHistory.error.fetch' }));
      } finally {
        setLoading(false);
      }
    },
    [accountId, t],
  );

  useEffect(() => {
    if (isOpen && accountId) {
      fetchHistory();
    } else if (!isOpen) {
      setHistory([]);
      setLastDoc(null);
      setHasMore(false);
      setManualValue('');
      setError(null);
    }
  }, [isOpen, accountId, fetchHistory]);

  if (!isOpen || !account) return null;

  const runReconciliationAction = async (payload: Record<string, unknown>) => {
    setActionLoading(true);
    setError(null);

    try {
      const reconcileAction = httpsCallable(functions, 'reconcile_balance_action');
      await reconcileAction(payload);
      await fetchHistory();
    } catch (err) {
      console.error('Error during reconciliation action:', err);
      const msg = err instanceof Error ? err.message : t({ id: 'balanceHistory.error.action' });
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmCurrentBalance = () => {
    runReconciliationAction(
      buildConfirmReconciliationPayload({
        accountId,
        isSavings: account.is_savings || false,
      }),
    );
  };

  const forceManualBalance = () => {
    const parsedValue = Number.parseFloat(manualValue.replace(',', '.'));
    if (!Number.isFinite(parsedValue)) {
      setError(t({ id: 'balanceHistory.error.invalidBalance' }));
      return;
    }

    runReconciliationAction(
      buildManualOverridePayload({
        accountId,
        isSavings: account.is_savings || false,
        value: parsedValue,
      }),
    );
    setManualValue('');
  };

  const chooseDiscrepancySource = (discrepancy: Discrepancy, source: string, value: number) => {
    runReconciliationAction(
      buildSourceChoicePayload({
        accountId,
        isSavings: account.is_savings || false,
        discrepancyId: discrepancy.id,
        source,
        value,
      }),
    );
  };

  const handleOverlayClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const balanceValue = pickBalanceValue(account);

  return (
    <div
      className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleOverlayClick(e);
        if (e.key === 'Escape') onClose();
      }}
      role="button"
      tabIndex={0}
      aria-label="Fermer la modale"
    >
      <div
        className="modal-card balance-history-modal max-w-3xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2>{t({ id: 'balanceHistory.title' }, { name: accountName })}</h2>
          <button
            className="btn-close-modal"
            onClick={onClose}
            disabled={actionLoading}
            aria-label={t({ id: 'action.close' })}
          >
            &times;
          </button>
        </div>

        <div className="history-content space-y-6">
          {error && (
            <div className="rounded-xl border border-negative/20 bg-negative/10 p-4 text-xs font-bold text-negative">
              {error}
            </div>
          )}

          <section className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
            <div className="rounded-xl border border-separator bg-white/5 p-4">
              <div className="text-caption font-semibold text-label/40">
                {t({ id: 'balanceHistory.kpi.balance' })}
              </div>
              <div className="mt-1 font-serif text-lg text-white">
                {typeof balanceValue === 'number' ? fmt(balanceValue) : '-'}
              </div>
            </div>
            <div className="rounded-xl border border-separator bg-white/5 p-4">
              <div className="text-caption font-semibold text-label/40">
                {t({ id: 'balanceHistory.kpi.previous' })}
              </div>
              <div className="mt-1 font-serif text-lg text-white">
                {typeof (account as unknown as Record<string, unknown>).previousSolde === 'number'
                  ? fmt((account as unknown as Record<string, unknown>).previousSolde as number)
                  : '-'}
              </div>
            </div>
            <div className="rounded-xl border border-separator bg-white/5 p-4">
              <div className="text-caption font-semibold text-label/40">
                {t({ id: 'balanceHistory.kpi.projection' })}
              </div>
              <div className="mt-1 font-serif text-lg text-white">
                {typeof (account as unknown as Record<string, unknown>).computedSolde === 'number'
                  ? fmt((account as unknown as Record<string, unknown>).computedSolde as number)
                  : '-'}
              </div>
            </div>
            <div className="rounded-xl border border-separator bg-white/5 p-4">
              <div className="text-caption font-semibold text-label/40">
                {t({ id: 'balanceHistory.kpi.gap' })}
              </div>
              <div
                className={`mt-1 font-serif text-lg ${hasAuditGap ? 'text-negative' : 'text-positive'}`}
              >
                {typeof auditGap === 'number' ? fmt(auditGap) : '-'}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-separator bg-surface p-4">
            <div className="mb-4 flex items-center gap-2 text-caption font-semibold text-gold">
              <ShieldCheck size={14} aria-hidden="true" />
              {t({ id: 'balanceHistory.section.simple' })}
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <button
                className="rounded-xl bg-gold px-4 py-4 text-caption font-semibold text-bg disabled:opacity-50"
                onClick={confirmCurrentBalance}
                disabled={actionLoading}
              >
                {t({ id: 'balanceHistory.action.markReconciled' })}
              </button>
              <input
                className="rounded-xl border border-separator bg-black/20 px-4 py-4 text-sm text-white outline-none focus:border-gold/40 disabled:opacity-50"
                type="text"
                inputMode="decimal"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder={t({ id: 'balanceHistory.placeholder.realBalance' })}
                aria-label={t({ id: 'balanceHistory.placeholder.realBalance' })}
                disabled={actionLoading}
              />
              <button
                className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-4 text-caption font-semibold text-gold disabled:opacity-50"
                onClick={forceManualBalance}
                disabled={actionLoading || !manualValue}
              >
                {t({ id: 'balanceHistory.action.force' })}
              </button>
            </div>
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-separator bg-white/5 px-4 py-4 text-caption font-semibold text-label/70 hover:text-white"
              onClick={onOpenReconciliation}
              disabled={actionLoading}
            >
              <GitCompareArrows size={14} aria-hidden="true" />
              {t({ id: 'balanceHistory.action.identifyGaps' })}
            </button>
          </section>

          {unresolvedDiscrepancies.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-caption font-semibold text-negative">
                <AlertTriangle size={14} aria-hidden="true" />
                {t({ id: 'balanceHistory.section.activeGaps' })}
              </div>
              {unresolvedDiscrepancies.map((discrepancy, index) => (
                <div
                  key={discrepancy.id || index}
                  className="rounded-lg border border-negative/20 bg-negative/10 p-4"
                >
                  <div className="text-sm font-bold text-white">{discrepancy.description}</div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <button
                      className="rounded-xl border border-separator bg-black/20 px-4 py-2 text-left text-xs text-white disabled:opacity-50"
                      onClick={() =>
                        chooseDiscrepancySource(
                          discrepancy,
                          discrepancy.source_1,
                          discrepancy.value_1,
                        )
                      }
                      disabled={actionLoading}
                    >
                      {discrepancy.source_1}: <strong>{fmt(discrepancy.value_1)}</strong>
                    </button>
                    <button
                      className="rounded-xl border border-separator bg-black/20 px-4 py-2 text-left text-xs text-white disabled:opacity-50"
                      onClick={() =>
                        chooseDiscrepancySource(
                          discrepancy,
                          discrepancy.source_2,
                          discrepancy.value_2,
                        )
                      }
                      disabled={actionLoading}
                    >
                      {discrepancy.source_2}: <strong>{fmt(discrepancy.value_2)}</strong>
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section>
            <div className="mb-4 flex items-center gap-2 text-caption font-semibold text-label/50">
              <History size={14} aria-hidden="true" />
              {t({ id: 'balanceHistory.section.history' })}
            </div>
            {loading ? (
              <div id="loader">
                <div className="spinner"></div>
                <p>{t({ id: 'balanceHistory.history.loading' })}</p>
              </div>
            ) : history.length === 0 ? (
              <div className="history-empty rounded-lg border border-dashed border-separator p-4">
                <CheckCircle2 size={22} className="mb-2 text-positive" aria-hidden="true" />
                <p>{t({ id: 'balanceHistory.history.empty' })}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => {
                  const meta = getEventMeta(entry.event_type);
                  const Icon = meta.Icon;
                  const delta =
                    entry.previous_balance !== undefined
                      ? entry.balance_value - entry.previous_balance
                      : undefined;

                  return (
                    <div
                      key={entry.id}
                      className="px-4 py-4 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        {/* Left: Icon + Event Info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meta.badgeBg}`}
                          >
                            <Icon size={18} className={meta.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className={`font-semibold ${meta.color}`}>{meta.label.main}</p>
                              {meta.label.sub && (
                                <span className="text-sm text-gray-400">{meta.label.sub}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(entry.timestamp.toDate(), {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            {entry.source && (
                              <p className="text-xs text-gray-500 mt-1">Source: {entry.source}</p>
                            )}
                          </div>
                        </div>

                        {/* Right: Balance Info */}
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="font-bold text-white">€{entry.balance_value.toFixed(2)}</p>
                          {delta !== undefined && (
                            <p
                              className={`text-xs font-medium mt-1 ${
                                delta >= 0 ? 'text-positive' : 'text-negative'
                              }`}
                            >
                              {delta >= 0 ? '+' : ''}€{delta.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => fetchHistory(lastDoc)}
                    disabled={loading}
                    className="w-full py-2 text-xs text-label-tertiary hover:text-label-secondary transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Chargement…' : 'Voir plus'}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={actionLoading}>
            {t({ id: 'balanceHistory.close' })}
          </button>
        </div>
      </div>
    </div>
  );
};
