import React from 'react';
import { AccountBalance } from '../types/balances';
import { fmt } from '../utils/format';
import { buildBalanceMismatchFingerprint } from '../utils/balanceMapping';

interface BalanceCardProps {
  balance: AccountBalance & {
    mismatchAckFingerprint?: string;
    ecart?: number;
    previousSolde?: number;
    linxoDelta?: number;
    computedSolde?: number;
    direction?: string;
  };
  /** Mouvements arrivés après le mail du solde, recalculés en direct (voir mouvementsDepuisSolde). */
  mouvementsDepuis?: { total: number; count: number } | null;
  onClick?: () => void;
  onHistoryClick?: (accountId: string, accountName: string) => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance: r,
  mouvementsDepuis,
  onClick,
  onHistoryClick,
}) => {
  const compte = r.compte || r.id || 'Compte';
  const status = r.status || 'pending_review';
  const fingerprint = buildBalanceMismatchFingerprint(r);
  const isMismatch = status === 'discrepancy_unresolved';
  const isPendingReview = status === 'pending_review';
  // Des opérations sont remontées après le mail du solde sans que le solde suive.
  const isStale = !!mouvementsDepuis && mouvementsDepuis.count > 0;
  const needsReconciliation = isMismatch || isPendingReview || isStale;
  const isMismatchAcked =
    isMismatch && r.mismatchAckFingerprint && r.mismatchAckFingerprint === fingerprint;

  const statusTxt = isStale
    ? 'NON À JOUR'
    : status === 'reconciled'
      ? 'OK'
      : isMismatch
        ? isMismatchAcked
          ? 'Écart accepté'
          : 'Écart'
        : isPendingReview
          ? 'À RÉVISER'
          : 'À initialiser';

  const statusCls = isStale
    ? 'text-caption text-negative bg-negative/10 border border-negative/20'
    : status === 'reconciled'
      ? 'text-caption text-positive bg-positive/10 border border-positive/20'
      : isMismatch || isPendingReview
        ? isMismatchAcked
          ? 'text-caption text-warning bg-warning/10 border border-warning/20'
          : 'text-caption text-negative bg-negative/10 border border-negative/20'
        : 'text-caption text-label-tertiary bg-zinc-500/10 border border-zinc-500/20';

  const ecartValue = isMismatchAcked ? 0 : r.ecart;
  const prevValue = isMismatchAcked ? 0 : r.previousSolde;
  const deltaValue = isMismatchAcked ? 0 : r.linxoDelta;
  const computedValue = isMismatchAcked ? 0 : r.computedSolde;
  const soldeValue = r.current_balance !== undefined ? r.current_balance : r.solde;

  const ecart = typeof ecartValue === 'number' ? fmt(ecartValue) : '—';
  const prev = typeof prevValue === 'number' ? fmt(prevValue) : '—';
  const delta = typeof deltaValue === 'number' ? fmt(deltaValue) : '—';
  const computed = typeof computedValue === 'number' ? fmt(computedValue) : '—';
  const solde = typeof soldeValue === 'number' ? fmt(soldeValue) : '—';
  const accountId = r.id || r.compte || '';

  const handleReconciliation = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const handleHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHistoryClick?.(accountId, compte);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className={`p-6 bg-surface rounded-lg border border-separator transition-all hover:border-label/10 group ${needsReconciliation ? 'ring-1 ring-gold/20' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="text-label font-medium truncate pr-4 text-sm tracking-tight">{compte}</div>
        <div className={`px-2 py-1 rounded-full font-semibold whitespace-nowrap ${statusCls}`}>
          {statusTxt}
        </div>
      </div>

      <div className="mb-8">
        <div className="text-caption font-semibold text-label/40 mb-2">Solde disponible</div>
        <div className="font-serif text-3xl font-semibold text-label tabular-nums tracking-tight">
          {solde}
        </div>
      </div>

      <div className="space-y-2 text-caption font-medium mb-8">
        <div className="flex justify-between items-center py-1 border-b border-separator">
          <span className="text-label/30">
            {r.direction === 'BACKWARD' ? 'Dernier relevé' : 'Solde précédent'}
          </span>
          <span className="tabular-nums text-label/60">{prev}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-separator">
          <span className="text-label/30">Mouvements identifiés</span>
          <span className="tabular-nums text-label/60">{delta}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-separator">
          <span className="text-label/30">Projection</span>
          <span className="tabular-nums text-label/60 font-semibold">{computed}</span>
        </div>
        {mouvementsDepuis && (
          <div className="flex justify-between items-center py-1 border-b border-separator">
            <span className="text-label/30">
              Depuis ce solde ({mouvementsDepuis.count} opération
              {mouvementsDepuis.count > 1 ? 's' : ''})
            </span>
            <span
              className={`tabular-nums font-semibold ${isStale ? 'text-negative' : 'text-label/60'}`}
            >
              {fmt(mouvementsDepuis.total)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <span className="text-label/40 text-caption font-semibold">Écart audit</span>
          <span
            className={`tabular-nums font-bold ${ecartValue && ecartValue !== 0 ? 'text-negative' : 'text-positive'}`}
          >
            {ecart}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-separator">
        <button
          className="w-full py-2 rounded-xl bg-gold text-bg text-caption font-semibold hover:bg-gold-light transition-all shadow-lg shadow-gold/10"
          onClick={handleReconciliation}
        >
          Reconcilier
        </button>
        <button
          className="flex-1 py-2 rounded-xl bg-white/5 border border-separator text-caption font-semibold text-label/40 hover:text-label hover:bg-white/10 transition-all"
          onClick={handleHistory}
        >
          🕒 Historique
        </button>
      </div>
    </div>
  );
};
