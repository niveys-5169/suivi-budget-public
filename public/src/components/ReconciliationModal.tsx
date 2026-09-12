import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebase';
import { AccountBalance } from '../types/balances';
import { fmt, parseDecimal } from '../utils/format';
import {
  buildManualOverridePayload,
  buildSourceChoicePayload,
} from '../utils/reconciliationActions';
import { X, AlertTriangle, CheckCircle2, History, ShieldCheck } from 'lucide-react';
import { Modal } from './shared/Modal';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountBalance | null;
}

const INPUT_CLS =
  'h-14 rounded-lg border border-separator bg-raised text-lg px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all font-serif';
const LABEL_CLS = 'text-caption font-semibold text-label-tertiary mb-2 ml-1';

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  isOpen,
  onClose,
  account,
}) => {
  const { formatMessage: t } = useIntl();
  const [manualValue, setManualValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !account) return null;

  const unresolvedDiscrepancies =
    account.discrepancies?.filter((d) => d.status === 'unresolved') || [];

  const handleAction = async (actionType: string, payload: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions(app, 'europe-west1');
      const reconcileAction = httpsCallable(functions, 'reconcile_balance_action');

      let eventType = '';
      const functionPayload: Record<string, unknown> = {
        accountId: account.id,
        isSavings: account.is_savings || false,
      };

      if (actionType === 'CHOOSE_SOURCE') {
        Object.assign(
          functionPayload,
          buildSourceChoicePayload({
            accountId: account.id,
            isSavings: account.is_savings || false,
            discrepancyId: payload.discrepancyId as string,
            source: payload.source as string,
            value: payload.value as number,
          }),
        );
      } else if (actionType === 'ACKNOWLEDGE') {
        eventType = 'discrepancy_acknowledged';
        functionPayload.discrepancyId = payload.discrepancyId;
      } else if (actionType === 'SET_MANUAL_VALUE') {
        Object.assign(
          functionPayload,
          buildManualOverridePayload({
            accountId: account.id,
            isSavings: account.is_savings || false,
            value: payload.value as number,
          }),
        );
      }

      if (eventType) functionPayload.eventType = eventType;

      await reconcileAction(functionPayload);
      onClose();
    } catch (err) {
      console.error('Error during reconciliation action:', err);
      const msg = err instanceof Error ? err.message : t({ id: 'reconciliation.error.action' });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    const val = parseDecimal(manualValue);
    if (val === null) return;
    handleAction('SET_MANUAL_VALUE', { value: val });
    setManualValue('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t({ id: 'reconciliation.title' })} ${t({ id: 'reconciliation.title.emphasis' })}`}
      subtitle={account.compte}
      variant="centered"
      size="lg"
    >
      <div className="flex flex-col">
        <div className="p-8 space-y-10">
          {error && (
            <div
              role="alert"
              className="p-4 bg-negative/10 border border-negative/20 rounded-lg text-negative text-xs font-bold flex items-center gap-4"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className={LABEL_CLS}>{t({ id: 'reconciliation.label.registerBalance' })}</p>
              <div className="bg-surface rounded-lg p-6 flex flex-col items-center justify-center text-center">
                <ShieldCheck size={24} className="text-label-tertiary mb-2" aria-hidden="true" />
                <div className="font-serif text-3xl font-semibold text-white tabular-nums tracking-tighter">
                  {fmt(account.current_balance)}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="rm-manual" className={LABEL_CLS}>
                {t({ id: 'reconciliation.label.manualAdjustment' })}
              </label>
              <div className="flex flex-col gap-4">
                <input
                  id="rm-manual"
                  type="text"
                  inputMode="decimal"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={t({ id: 'reconciliation.placeholder.newBalance' })}
                  aria-label={t({ id: 'reconciliation.placeholder.newBalance' })}
                  disabled={loading}
                  className={INPUT_CLS}
                />
                <button
                  className="h-12 rounded-xl bg-gold text-bg font-semibold text-caption hover:bg-gold-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={handleManualSubmit}
                  disabled={!manualValue || loading}
                >
                  {loading ? (
                    <div className="w-3 h-3 border-2 border-bg/20 border-t-ink rounded-full animate-spin" />
                  ) : (
                    <ShieldCheck size={14} aria-hidden="true" />
                  )}
                  {t({ id: 'reconciliation.action.forceValue' })}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 ml-1">
              <History size={16} className="text-gold" aria-hidden="true" />
              <h3 className="text-caption font-semibold text-gold">
                {t({ id: 'reconciliation.section.discrepancies' })}
              </h3>
            </div>

            {unresolvedDiscrepancies.length === 0 ? (
              <div className="py-12 bg-surface rounded-lg border-dashed border-zinc-800 flex flex-col items-center justify-center text-center gap-4">
                <CheckCircle2 size={32} className="text-positive/20" aria-hidden="true" />
                <p className="text-caption font-semibold text-label-tertiary">
                  {t({ id: 'reconciliation.empty' })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {unresolvedDiscrepancies.map((d, index) => (
                  <div
                    key={d.id || index}
                    className="bg-surface rounded-lg p-6 border-separator space-y-6"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <strong className="text-sm font-bold text-white tracking-tight">
                          {d.description}
                        </strong>
                        <div className="text-caption font-semibold text-label-tertiary">
                          {t(
                            { id: 'reconciliation.discrepancy.detected' },
                            {
                              date:
                                d.detected_on && typeof d.detected_on.toDate === 'function'
                                  ? d.detected_on.toDate().toLocaleDateString('fr-FR')
                                  : '—',
                            },
                          )}
                        </div>
                      </div>
                      <div className="px-4 py-1 rounded-full bg-negative/10 border border-negative/20 text-negative text-caption font-semibold">
                        {t({ id: 'reconciliation.discrepancy.anomaly' })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-white/5 border border-separator flex flex-col gap-1">
                        <span className="text-caption font-semibold text-label-tertiary">
                          {d.source_1}
                        </span>
                        <span className="font-serif text-lg font-bold text-white tabular-nums">
                          {fmt(d.value_1)}
                        </span>
                      </div>
                      <div className="p-4 rounded-lg bg-white/5 border border-separator flex flex-col gap-1">
                        <span className="text-caption font-semibold text-label-tertiary">
                          {d.source_2}
                        </span>
                        <span className="font-serif text-lg font-bold text-white tabular-nums">
                          {fmt(d.value_2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        className="flex-1 h-11 rounded-xl border border-gold/20 bg-gold/5 text-gold text-caption font-semibold hover:bg-gold/10 transition-all disabled:opacity-50"
                        disabled={loading}
                        onClick={() =>
                          handleAction('CHOOSE_SOURCE', {
                            discrepancyId: d.id,
                            source: d.source_1,
                            value: d.value_1,
                          })
                        }
                      >
                        {t({ id: 'reconciliation.discrepancy.source' }, { name: d.source_1 })}
                      </button>
                      <button
                        className="flex-1 h-11 rounded-xl border border-gold/20 bg-gold/5 text-gold text-caption font-semibold hover:bg-gold/10 transition-all disabled:opacity-50"
                        disabled={loading}
                        onClick={() =>
                          handleAction('CHOOSE_SOURCE', {
                            discrepancyId: d.id,
                            source: d.source_2,
                            value: d.value_2,
                          })
                        }
                      >
                        {t({ id: 'reconciliation.discrepancy.source' }, { name: d.source_2 })}
                      </button>
                      <button
                        className="w-12 h-11 rounded-xl bg-white/5 border border-separator text-label-tertiary hover:text-white transition-all flex items-center justify-center disabled:opacity-50"
                        disabled={loading}
                        onClick={() => handleAction('ACKNOWLEDGE', { discrepancyId: d.id })}
                        title={t({ id: 'reconciliation.discrepancy.ignore.title' })}
                        aria-label={t({ id: 'reconciliation.discrepancy.ignore.title' })}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 border-t border-separator flex justify-end">
          <button
            className="px-8 py-4 rounded-xl bg-surface border border-separator text-label-secondary hover:text-white text-xs font-semibold transition-all"
            onClick={onClose}
            disabled={loading}
          >
            {t({ id: 'reconciliation.close' })}
          </button>
        </div>
      </div>
    </Modal>
  );
};
