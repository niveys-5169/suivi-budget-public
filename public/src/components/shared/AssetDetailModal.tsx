import React, { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Modal } from './Modal';
import { Button } from './Button';
import { PeriodPills } from './PeriodPills';
import { DeltaValue } from '../WealthEvolutionTable';
import { OWNER_COLORS } from '../WealthAccountsList';
import {
  buildAssetSeries,
  computeAssetEvolution,
  periodRangeISO,
  type EvolutionPeriod,
} from '../../utils/wealthEvolution';
import { resolveHistoryAssetIds, resolveHoldingAssetId } from '../../utils/historyAssetResolver';
import type { RawHistoryEntry } from '../../utils/wealthTimeline';
import type { PortfolioTx } from '../../utils/portfolioReconstruction';
import { safeSegment } from '../../utils/portfolioReconstruction';
import { CHART_COLORS } from '../../lib/colors';
import { fmt } from '../../utils/format';
import { BarChart3 } from 'lucide-react';

export interface AssetDetailTarget {
  kind: 'asset' | 'holding';
  id: string;
  name: string;
  owner: string;
  type: string;
  currentValue: number;
  isin?: string;
  account?: string;
}

interface AssetDetailPortfolio {
  connected: boolean;
  login: () => void;
  txLoading: boolean;
  fetchTransactions: () => Promise<PortfolioTx[] | null>;
}

interface AssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: AssetDetailTarget | null;
  placementHistory: RawHistoryEntry[];
  portfolio: AssetDetailPortfolio;
  /** Fourni uniquement pour les placements manuels : bascule vers la modale d'édition. */
  onEdit?: (target: AssetDetailTarget) => void;
}

const TYPE_LABEL_IDS: Record<string, string> = {
  cash: 'wealth.kpi.cash',
  savings: 'wealth.kpi.savings',
  investissements: 'wealth.kpi.investments',
  retirement: 'wealth.evolution.cat.retirement',
};

const TX_LABEL_IDS: Record<string, string> = {
  BUY: 'wealth.assetDetail.tx.buy',
  SELL: 'wealth.assetDetail.tx.sell',
  DIVIDEND: 'wealth.assetDetail.tx.dividend',
  TRANSFER_IN: 'wealth.assetDetail.tx.transferIn',
  TRANSFER_OUT: 'wealth.assetDetail.tx.transferOut',
};

const HISTORY_PAGE = 30;

const SECTION_TITLE_CLS = 'text-caption font-bold text-label-tertiary';

function frDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Détail d'une position patrimoniale : évolution sur période choisie,
 * sparkline, historique de valeur et transactions (positions boursières).
 * Bottom sheet sur mobile, centré sur desktop (shell Modal partagé).
 */
export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  isOpen,
  onClose,
  target,
  placementHistory,
  portfolio,
  onEdit,
}) => {
  const { formatMessage: t } = useIntl();
  const [period, setPeriod] = useState<EvolutionPeriod>('1Y');
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const [txs, setTxs] = useState<PortfolioTx[] | null>(null);

  const isHolding = target?.kind === 'holding';

  // Réinitialise l'état local à chaque ouverture / changement de cible.
  const openKey = isOpen ? `open:${target?.id ?? ''}` : 'closed';
  const [seenOpenKey, setSeenOpenKey] = useState(openKey);
  if (openKey !== seenOpenKey) {
    setSeenOpenKey(openKey);
    if (isOpen) {
      setPeriod('1Y');
      setHistoryLimit(HISTORY_PAGE);
      setTxs(null);
    }
  }

  // Charge les transactions du portefeuille pour les positions boursières.
  useEffect(() => {
    if (!isOpen || !isHolding || !portfolio.connected) return;
    let cancelled = false;
    portfolio.fetchTransactions().then((result) => {
      if (!cancelled) setTxs(result || []);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isHolding, portfolio.connected, target?.id]);

  const assetIds = useMemo(() => {
    if (!target) return new Set<string>();
    if (target.kind === 'holding') {
      return new Set([
        resolveHoldingAssetId({
          isin: target.isin || '',
          owner: target.owner,
          account: target.account || '',
        }),
      ]);
    }
    return resolveHistoryAssetIds(
      { id: target.id, name: target.name, ownerId: target.owner, type: target.type },
      placementHistory,
    );
  }, [target, placementHistory]);

  const series = useMemo(
    () => buildAssetSeries(placementHistory, assetIds),
    [placementHistory, assetIds],
  );

  const range = useMemo(() => periodRangeISO(period, new Date()), [period]);
  const evolution = useMemo(
    () => computeAssetEvolution(series, range.from, range.to),
    [series, range],
  );

  const reversedPoints = useMemo(() => [...evolution.points].reverse(), [evolution.points]);

  const filteredTxs = useMemo(() => {
    if (!txs || !target?.isin) return [];
    const isin = target.isin.toUpperCase();
    const account = target.account ? safeSegment(target.account) : '';
    return txs
      .filter((tx) => (tx.isin || '').toUpperCase() === isin)
      .filter((tx) => {
        // Filtre par enveloppe tolérant : uniquement si les deux côtés sont renseignés.
        const env = tx.envelope || tx.account || '';
        return !account || !env || safeSegment(env) === account;
      })
      .filter((tx) => (!range.from || tx.date >= range.from) && (!range.to || tx.date <= range.to))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txs, target, range]);

  if (!target) return null;

  const ownerKey = target.owner.toLowerCase();
  const ownerColor = OWNER_COLORS[ownerKey] || '#888';
  const typeLabel = TYPE_LABEL_IDS[target.type]
    ? t({ id: TYPE_LABEL_IDS[target.type] })
    : target.type;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={target.name}
      subtitle={typeLabel}
      variant="sheet"
      size="lg"
      headerActions={
        onEdit && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(target)}>
            {t({ id: 'action.edit' })}
          </Button>
        )
      }
    >
      <div className="p-6 space-y-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {/* Valeur actuelle */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={SECTION_TITLE_CLS}>{t({ id: 'wealth.assetDetail.currentValue' })}</p>
            <p className="font-serif text-3xl font-semibold text-gold tabular-nums mt-1">
              {fmt(target.currentValue)}
            </p>
          </div>
          <span
            className="text-caption font-semibold px-2 py-1 rounded-md border border-current/20 bg-current/5 whitespace-nowrap"
            style={{ color: ownerColor }}
          >
            {target.owner}
          </span>
        </div>

        {/* Période d'analyse */}
        <PeriodPills
          periods={['1M', '3M', '6M', '1Y', 'all']}
          value={period}
          onChange={setPeriod}
        />

        {series.length === 0 || !evolution.points.length ? (
          <p className="text-sm text-label-tertiary py-4">
            {t({ id: 'wealth.assetDetail.noData' })}
          </p>
        ) : (
          <>
            {/* Début / Fin / Variation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-tile bg-surface border border-separator p-4">
                <p className={SECTION_TITLE_CLS}>{t({ id: 'wealth.evolution.col.start' })}</p>
                <p className="text-lg font-bold text-label-secondary tabular-nums mt-1">
                  {fmt(evolution.start)}
                </p>
                <p className="text-caption text-label-tertiary mt-1">
                  {evolution.points[0] && frDate(evolution.points[0].date)}
                </p>
              </div>
              <div className="rounded-tile bg-surface border border-separator p-4">
                <p className={SECTION_TITLE_CLS}>{t({ id: 'wealth.evolution.col.end' })}</p>
                <p className="text-lg font-bold text-white tabular-nums mt-1">
                  {fmt(evolution.end)}
                </p>
                <p className="text-caption text-label-tertiary mt-1">
                  {evolution.points.length > 0 &&
                    frDate(evolution.points[evolution.points.length - 1]!.date)}
                </p>
              </div>
              <div className="col-span-2 rounded-tile bg-surface border border-separator p-4 flex items-center justify-between">
                <p className={SECTION_TITLE_CLS}>{t({ id: 'wealth.evolution.col.delta' })}</p>
                <DeltaValue delta={evolution.delta} pct={evolution.deltaPct} />
              </div>
            </div>

            {/* Sparkline */}
            {evolution.points.length >= 2 && (
              <div className="rounded-tile bg-surface border border-separator p-4">
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart
                    data={evolution.points}
                    margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="assetDetailGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="timestamp" hide type="number" domain={['dataMin', 'dataMax']} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: '#121622',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelFormatter={(ts) => frDate(new Date(Number(ts)).toISOString())}
                      formatter={(value) => [fmt(Number(value)), '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.gold}
                      strokeWidth={2}
                      fill="url(#assetDetailGold)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Historique de valeur / Mouvements */}
            <div className="space-y-4">
              <h3 className={SECTION_TITLE_CLS}>
                {t({
                  id: isHolding ? 'wealth.assetDetail.history' : 'wealth.assetDetail.movements',
                })}
              </h3>
              <div className="space-y-1">
                {reversedPoints.slice(0, historyLimit).map((point, i) => {
                  const prev = reversedPoints[i + 1];
                  const diff = prev ? point.value - prev.value : null;
                  return (
                    <div
                      key={point.date}
                      className="flex items-center justify-between gap-4 py-2 border-b border-separator last:border-b-0"
                    >
                      <span className="text-sm text-label-secondary">{frDate(point.date)}</span>
                      <div className="flex items-center gap-4">
                        {diff !== null && diff !== 0 && (
                          <span
                            className={`text-caption font-bold tabular-nums ${
                              diff > 0 ? 'text-positive' : 'text-negative'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {fmt(diff)}
                          </span>
                        )}
                        <span className="text-sm font-bold text-white tabular-nums">
                          {fmt(point.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {reversedPoints.length > historyLimit && (
                <button
                  type="button"
                  onClick={() => setHistoryLimit((l) => l + HISTORY_PAGE)}
                  className="w-full min-h-[44px] rounded-control bg-white/5 border border-separator text-caption font-bold text-label-secondary hover:bg-white/10 transition-colors"
                >
                  {t({ id: 'wealth.assetDetail.showMore' })}
                </button>
              )}
            </div>
          </>
        )}

        {/* Transactions (positions boursières) */}
        {isHolding && (
          <div className="space-y-4">
            <h3 className={SECTION_TITLE_CLS}>{t({ id: 'wealth.assetDetail.transactions' })}</h3>
            {!portfolio.connected ? (
              <button
                type="button"
                onClick={portfolio.login}
                className="w-full flex items-center justify-between px-4 py-4 rounded-tile bg-gold/5 border border-gold/20 hover:bg-gold/10 transition-all"
              >
                <div className="flex items-center gap-4 text-left">
                  <BarChart3 size={16} className="text-gold/60" aria-hidden="true" />
                  <span className="text-sm text-label-secondary">
                    {t({ id: 'wealth.assetDetail.connectPortfolio' })}
                  </span>
                </div>
                <span className="text-caption font-semibold text-gold/80">
                  {t({ id: 'wealth.assetDetail.connect' })} →
                </span>
              </button>
            ) : portfolio.txLoading && txs === null ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
              </div>
            ) : filteredTxs.length === 0 ? (
              <p className="text-sm text-label-tertiary">{t({ id: 'wealth.assetDetail.noTx' })}</p>
            ) : (
              <div className="space-y-1">
                {filteredTxs.map((tx, i) => {
                  const txType = String(tx.type || '')
                    .trim()
                    .toUpperCase();
                  const isBuy = txType === 'BUY' || txType === 'TRANSFER_IN';
                  const labelId = TX_LABEL_IDS[txType];
                  return (
                    <div
                      key={`${tx.date}_${i}`}
                      className="flex items-center justify-between gap-4 py-2 border-b border-separator last:border-b-0"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span
                          className={`text-caption font-semibold px-2 py-1 rounded-md flex-shrink-0 ${
                            isBuy ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
                          }`}
                        >
                          {labelId ? t({ id: labelId }) : txType}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-label-secondary">{frDate(tx.date)}</p>
                          {Number(tx.quantity) > 0 && (
                            <p className="text-caption text-label-tertiary">
                              {t({ id: 'wealth.assetDetail.tx.qty' }, { qty: Number(tx.quantity) })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
                        {fmt(Math.abs(Number(tx.amount) || 0))}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
