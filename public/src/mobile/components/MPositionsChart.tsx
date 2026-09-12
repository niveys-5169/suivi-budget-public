import React, { useState, useMemo } from 'react';
import { CHART_COLORS } from '../../lib/colors';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { buildWealthTimeline, WealthPoint } from '../../utils/wealthTimeline';
import { periodRangeISO, type EvolutionPeriod } from '../../utils/wealthEvolution';

import { formatCurrency } from '../../lib/formatters';
import type { WealthHistoryEntry } from '../../types/patrimoine';

interface Props {
  placementHistory: WealthHistoryEntry[];
  /** Période partagée avec la section Évolution (sélecteur unique dans l'écran). */
  period: EvolutionPeriod;
}

const SERIES = [
  { key: 'courants', label: 'Liquidités', color: CHART_COLORS.emerald },
  { key: 'epargne', label: 'Épargne', color: CHART_COLORS.gold },
  { key: 'investissements', label: 'Invest.', color: CHART_COLORS.blue },
  { key: 'retraite', label: 'Retraite', color: CHART_COLORS.violet },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

const fmt = (v: number) => formatCurrency(v, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

export const MPositionsChart: React.FC<Props> = ({ placementHistory, period }) => {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());

  const chartData = useMemo(() => {
    if (!placementHistory?.length) return [];
    const timeline = buildWealthTimeline(placementHistory);
    const { from } = periodRangeISO(period);
    const threshold = from ? new Date(from).getTime() : -Infinity;
    return timeline
      .filter((d) => d.timestamp >= threshold)
      .map((p: WealthPoint) => ({
        timestamp: p.timestamp,
        courants: p.byCat.courants,
        epargne: p.byCat.epargne,
        investissements: p.byCat.investissements,
        retraite: p.byCat.retraite,
      }));
  }, [placementHistory, period]);

  const hasData = useMemo(
    () => chartData.some((d) => SERIES.some((s) => d[s.key] > 0)),
    [chartData],
  );

  if (!hasData) {
    return (
      <div className="h-36 flex items-center justify-center border border-dashed border-separator rounded-lg">
        <p className="text-footnote text-label-tertiary">Aucune donnée de positions</p>
      </div>
    );
  }

  const toggleSeries = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
          <XAxis
            dataKey="timestamp"
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_COLORS.axis, fontSize: 9, fontWeight: 700 }}
            dy={8}
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ts) =>
              new Date(ts).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
            }
            minTickGap={40}
          />
          <YAxis hide domain={['dataMin * 0.97', 'dataMax * 1.03']} />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.tooltipBg,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 11,
            }}
            formatter={(value, name) => [fmt(Number(value)), name]}
            labelFormatter={(ts) =>
              new Date(ts as string | number).toLocaleDateString('fr-FR', {
                month: 'short',
                year: 'numeric',
              })
            }
          />
          {SERIES.map((s) =>
            hidden.has(s.key) ? null : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: s.color, stroke: CHART_COLORS.ink, strokeWidth: 2 }}
              />
            ),
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-4 px-1">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => toggleSeries(s.key)}
            className="px-4 py-2 bg-surface border border-separator rounded-xl flex items-center gap-2 transition-opacity active:opacity-60"
            style={{ opacity: hidden.has(s.key) ? 0.3 : 1 }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-caption font-bold" style={{ color: s.color }}>
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
