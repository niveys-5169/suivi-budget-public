import React, { useMemo } from 'react';
import { CHART_COLORS } from '../../lib/colors';
import { useIntl } from 'react-intl';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { fmt } from '../../utils/format';

interface BudgetTrendChartProps {
  consumption: { periodeDebut: string; periodeFin: string; montant: number };
  transactions: { date: string; montant: number }[];
}

interface PointDatum {
  /** Day label rendered on the X axis (e.g. "12 janv."). */
  label: string;
  /** Cumulative real spend up to this day; null after today (no future line). */
  real: number | null;
  /** Cumulative theoretical pace for this day (linear over the period). */
  theorique: number;
}

/**
 * Renders the budget burn-down vs ideal pace for a budget envelope.
 *
 * Ported from a Chart.js implementation in commit history; pure Recharts now
 * to drop the secondary chart dependency from the bundle.
 */
const BudgetTrendChartImpl: React.FC<BudgetTrendChartProps> = ({ consumption, transactions }) => {
  const { formatMessage: t } = useIntl();

  const { data, todayLabel } = useMemo(() => {
    const { periodeDebut, periodeFin, montant } = consumption;
    const start = new Date(periodeDebut);
    const end = new Date(periodeFin);
    const days = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    // Group transactions by ISO date once for O(days) cumulation.
    const txByDay: Record<string, number> = {};
    for (const tx of transactions) {
      txByDay[tx.date] = (txByDay[tx.date] || 0) + Math.abs(tx.montant);
    }

    const today = new Date();
    const formatLabel = (d: Date) =>
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

    let running = 0;
    const points: PointDatum[] = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().split('T')[0]!;
      running += txByDay[iso] || 0;
      return {
        label: formatLabel(d),
        real: d <= today ? running : null,
        theorique: (montant / days) * (i + 1),
      };
    });

    return { data: points, todayLabel: formatLabel(today) };
  }, [consumption, transactions]);

  return (
    <div style={{ height: '300px', width: '100%', marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgba(237,237,237,0.3)"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis
            stroke="rgba(237,237,237,0.3)"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => fmt(v)}
            width={70}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(212,175,55,0.3)', strokeWidth: 1 }}
            contentStyle={{
              background: 'rgba(11,11,20,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: 'rgba(237,237,237,0.5)', fontWeight: 600 }}
            formatter={
              ((value: unknown, name: unknown) => [
                fmt(typeof value === 'number' ? value : 0),
                String(name ?? ''),
              ]) as never
            }
          />
          {/* Today marker — golden vertical reference. */}
          <ReferenceLine
            x={todayLabel}
            stroke="rgba(212,175,55,0.4)"
            strokeWidth={2}
            ifOverflow="hidden"
          />
          <Line
            type="monotone"
            dataKey="real"
            name={t({ id: 'budget.trend.real' })}
            stroke={CHART_COLORS.gold}
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="linear"
            dataKey="theorique"
            name={t({ id: 'budget.trend.theoretical' })}
            stroke="rgba(237,237,237,0.5)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const BudgetTrendChart = React.memo(BudgetTrendChartImpl);
