import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { buildWealthTimeline, type WealthCategory } from '../../utils/wealthTimeline';
import { periodRangeISO, type EvolutionPeriod } from '../../utils/wealthEvolution';
import type { OwnerScope } from '../../hooks/useWealthScope';
import { FormattedNumber } from 'react-intl';
import { formatCurrency } from '../../lib/formatters';
import { CHART_COLORS } from '../../lib/colors';
import type { WealthHistoryEntry, PatrimoineSnapshot } from '../../types/patrimoine';

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
};

/** Clés du filtre de type (MPatrimoineFilterModal) → catégories de la timeline. */
const SCOPE_KEY_TO_CAT: Record<string, WealthCategory> = {
  courants: 'courants',
  epargnelivrets: 'epargne',
  investissements: 'investissements',
  retraite: 'retraite',
};

interface Props {
  placementHistory: WealthHistoryEntry[];
  /** Fallback quand placementHistory est vide (voir usage de `patrimoineSnapshots` ci-dessous). */
  patrimoineSnapshots: PatrimoineSnapshot[];
  /** Période partagée avec le reste de la section Évolution (sélecteur unique). */
  period: EvolutionPeriod;
  /** Périmètre identique au hero « Valeur nette totale » pour des totaux cohérents. */
  ownerScope: OwnerScope;
  wealthTypeScope: string[] | 'all';
}

const MPatrimoineChartImpl: React.FC<Props> = ({
  placementHistory: history,
  patrimoineSnapshots,
  period,
  ownerScope,
  wealthTypeScope,
}) => {
  const visibleCats = useMemo<WealthCategory[] | null>(() => {
    if (wealthTypeScope === 'all' || wealthTypeScope.length === 0) return null;
    return wealthTypeScope
      .map((key) => SCOPE_KEY_TO_CAT[key])
      .filter((c): c is WealthCategory => Boolean(c));
  }, [wealthTypeScope]);

  const data = useMemo(() => {
    const { from } = periodRangeISO(period);
    const threshold = from ? new Date(from).getTime() : -Infinity;
    let points: { label: string; total: number; timestamp: number }[];
    if (history?.length > 0) {
      const timeline = buildWealthTimeline(history, {
        ownerFilter: ownerScope === 'all' ? undefined : ownerScope,
      });
      points = timeline
        .filter((d) => d.timestamp >= threshold)
        .map((d) => ({
          label: d.date,
          // Même périmètre que le hero : total restreint aux catégories filtrées.
          total: visibleCats ? visibleCats.reduce((s, cat) => s + d.byCat[cat], 0) : d.amount,
          timestamp: d.timestamp,
        }));
    } else {
      // Fallback : snapshots mensuels
      points = [...patrimoineSnapshots]
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map((snap) => {
          const total = Object.values(snap.owners).reduce((sum, o) => sum + (o.total || 0), 0);
          const label = new Date(snap.monthKey + '-01').toLocaleDateString('fr-FR', {
            month: 'short',
            year: '2-digit',
          });
          return { label, total, timestamp: new Date(snap.monthKey + '-01').getTime() };
        })
        .filter((p) => p.timestamp >= threshold);
    }

    return points;
  }, [history, patrimoineSnapshots, period, ownerScope, visibleCats]);

  if (data.length < 2) {
    return (
      <div className="aspect-[2/1] w-full flex items-center justify-center">
        <p className="text-footnote text-label-tertiary">Pas encore de données historiques</p>
      </div>
    );
  }

  const lastPoint = data[data.length - 1]!;
  const firstPoint = data[0]!;
  const delta = lastPoint.total - firstPoint.total;
  const isPositive = delta >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-4">
          <span className="text-title2 font-bold text-white tabular-nums">
            <FormattedNumber
              value={lastPoint.total}
              style="currency"
              currency="EUR"
              maximumFractionDigits={0}
            />
          </span>
          <span
            className={`text-footnote font-bold ${isPositive ? 'text-positive' : 'text-negative'}`}
          >
            {isPositive ? '+' : ''}
            <FormattedNumber
              value={delta}
              style="currency"
              currency="EUR"
              maximumFractionDigits={0}
            />
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="chartGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tick={{ fill: CHART_COLORS.axis, fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts) =>
              new Date(ts).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
            }
            minTickGap={40}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: CHART_COLORS.axis, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.tooltipBg,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: '#a1a1aa', fontWeight: 700 }}
            labelFormatter={(ts) =>
              new Date(ts).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
            }
            formatter={(value) =>
              formatCurrency(Number(value), 'EUR', 'fr-FR', { maximumFractionDigits: 0 })
            }
            itemStyle={{ color: CHART_COLORS.gold }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={CHART_COLORS.gold}
            strokeWidth={2}
            fill="url(#chartGold)"
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.gold, strokeWidth: 0 }}
            name="Patrimoine"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MPatrimoineChart = React.memo(MPatrimoineChartImpl);
