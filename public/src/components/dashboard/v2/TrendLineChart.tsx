import React, { useMemo } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { MonthlyBreakdown } from '../../../utils/computeSpendingTrends';

const CATEGORY_COLORS = [
  CHART_COLORS.gold,
  CHART_COLORS.ruby,
  CHART_COLORS.emerald,
  CHART_COLORS.blue,
  CHART_COLORS.violet,
  CHART_COLORS.amber,
  CHART_COLORS.pink,
];

import { formatCurrency } from '../../../lib/formatters';

const fmt = (n: number) => formatCurrency(n, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    color: string;
    name: string;
    dataKey: string | number;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-4 py-4 rounded-lg bg-surface border border-separator shadow-floating min-w-[160px]">
      <p className="text-label-tertiary text-caption font-semibold mb-4">{label}</p>
      <div className="space-y-2">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-caption font-bold text-label-secondary truncate max-w-[90px]">
                {p.dataKey}
              </span>
            </div>
            <span className="text-caption font-serif font-bold text-white tabular-nums">
              {fmt(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface TrendLineChartProps {
  breakdown: MonthlyBreakdown[];
}

const TrendLineChartImpl: React.FC<TrendLineChartProps> = ({ breakdown }) => {
  const { topCats, chartData } = useMemo(() => {
    // Pick top 5 categories by total spend across all months
    const catTotals = new Map<string, number>();
    for (const m of breakdown) {
      for (const [cat, amount] of Object.entries(m.byCategory)) {
        catTotals.set(cat, (catTotals.get(cat) ?? 0) + amount);
      }
    }
    const topCats = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const chartData = breakdown.map((m) => ({
      label: m.label,
      ...Object.fromEntries(topCats.map((cat) => [cat, m.byCategory[cat] ?? 0])),
    }));

    return { topCats, chartData };
  }, [breakdown]);

  if (breakdown.length === 0) return null;

  const isAnimationActive = chartData.length <= 100;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.20)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}€`}
        />
        <Tooltip content={<CustomTooltip />} />
        {topCats.map((cat, i) => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={isAnimationActive}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export const TrendLineChart = React.memo(TrendLineChartImpl);
