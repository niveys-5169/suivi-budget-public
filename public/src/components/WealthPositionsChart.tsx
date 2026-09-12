import React, { useState, useMemo } from 'react';
import { CHART_COLORS } from '../lib/colors';
import type { WealthHistoryEntry } from '../types/patrimoine';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { buildWealthTimeline, WealthPoint } from '../utils/wealthTimeline';

interface Props {
  placementHistory: WealthHistoryEntry[];
}

const SERIES = [
  { key: 'courants', label: 'Liquidités', color: CHART_COLORS.emerald },
  { key: 'epargne', label: 'Épargne', color: CHART_COLORS.gold },
  { key: 'investissements', label: 'Investissements', color: '#3B82F6' },
  { key: 'retraite', label: 'Retraite', color: '#8B5CF6' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

import { formatCurrency } from '../lib/formatters';

const fmt = (v: number) => formatCurrency(v, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    color: string;
    name: string;
    dataKey: string | number;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p) => s + (p.value || 0), 0);
  return (
    <div className="px-4 py-4 rounded-lg bg-bg/95 backdrop-blur-3xl border border-separator min-w-[200px]">
      <p className="text-white/30 text-caption font-semibold mb-4">{label}</p>
      <div className="flex flex-col gap-2 mb-4">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-caption font-bold text-white/50">{p.name}</span>
            </div>
            <span className="text-caption font-bold tabular-nums" style={{ color: p.color }}>
              {fmt(p.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-separator pt-2 flex justify-between items-center">
        <span className="text-caption font-semibold text-label-tertiary">Total</span>
        <span className="text-sm font-bold text-white tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
};

const WealthPositionsChartImpl: React.FC<Props> = ({ placementHistory = [] }) => {
  const [timeRange, setTimeRange] = useState<'6M' | '1Y' | 'ALL'>('1Y');
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());

  const chartData = useMemo(() => {
    if (!placementHistory?.length) return [];

    const timeline = buildWealthTimeline(placementHistory);

    const filtered =
      timeRange === 'ALL'
        ? timeline
        : (() => {
            const limitMs = (timeRange === '6M' ? 6 : 12) * 30 * 24 * 60 * 60 * 1000;
            const threshold = Date.now() - limitMs;
            return timeline.filter((d) => d.timestamp >= threshold);
          })();

    return filtered.map((p: WealthPoint) => ({
      date: p.date,
      fullDate: p.fullDate,
      timestamp: p.timestamp,
      courants: p.byCat.courants,
      epargne: p.byCat.epargne,
      investissements: p.byCat.investissements,
      retraite: p.byCat.retraite,
    }));
  }, [placementHistory, timeRange]);

  const hasAnyData = useMemo(
    () => chartData.some((d) => SERIES.some((s) => d[s.key] > 0)),
    [chartData],
  );

  if (!hasAnyData) {
    return (
      <div className="h-48 flex flex-col items-center justify-center border border-dashed border-separator rounded-xl gap-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        <p className="text-caption font-semibold text-label-tertiary">
          Aucune donnée de positions disponible
        </p>
        <p className="text-caption text-label-tertiary">
          Ajoutez des snapshots pour commencer le suivi
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex gap-2 bg-white/5 p-1 rounded-lg border border-separator">
          {(['6M', '1Y', 'ALL'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-4 py-2 rounded-xl text-caption font-semibold transition-all ${
                timeRange === r ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.key)) {
                    next.delete(s.key);
                  } else {
                    next.add(s.key);
                  }
                  return next;
                })
              }
              className="flex items-center gap-2 transition-opacity"
              style={{ opacity: hidden.has(s.key) ? 0.3 : 1 }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span
                className="text-caption font-semibold hidden md:block"
                style={{ color: s.color + 'CC' }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 700 }}
              dy={15}
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts) => {
                const date = new Date(ts);
                return date
                  .toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                  .replace('.', '');
              }}
              minTickGap={40}
            />
            <YAxis hide domain={['dataMin * 0.97', 'dataMax * 1.03']} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }}
            />
            {SERIES.map((s) =>
              hidden.has(s.key) ? null : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: s.color, stroke: '#0B0B14', strokeWidth: 2 }}
                  animationDuration={1500}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const WealthPositionsChart = React.memo(WealthPositionsChartImpl);
