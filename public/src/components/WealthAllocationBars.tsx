import React from 'react';
import { CHART_COLORS } from '../lib/colors';
import { motion } from 'framer-motion';

interface Segment {
  type: string;
  amount: number;
  pct: number;
}

interface WealthAllocationBarsProps {
  segments: Segment[];
}

const SEGMENT_LABELS: Record<string, string> = {
  cash: 'Disponibilités',
  savings: 'Épargne de précaution',
  investissements: 'Investissements',
  retirement: 'Retraite',
};

const SEGMENT_COLORS: Record<string, string> = {
  cash: '#E2E8F0',
  savings: '#94A3B8',
  investissements: CHART_COLORS.gold,
  retirement: '#64748B',
};

export const WealthAllocationBars: React.FC<WealthAllocationBarsProps> = ({ segments }) => {
  return (
    <div className="bg-white/5 rounded-xl p-8 md:p-12 border border-separator space-y-10">
      <div className="flex h-3 w-full bg-white/5 rounded-full overflow-hidden">
        {segments
          .filter((s) => s.amount > 0)
          .map((s) => (
            <motion.div
              key={s.type}
              initial={{ width: 0 }}
              animate={{ width: `${s.pct}%` }}
              className="h-full"
              style={{ backgroundColor: SEGMENT_COLORS[s.type] }}
              title={`${SEGMENT_LABELS[s.type]}: ${s.pct.toFixed(1)}%`}
            />
          ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8">
        {segments.map((s) => (
          <div key={s.type} className="space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: SEGMENT_COLORS[s.type] }}
              />
              <p className="text-caption font-semibold text-label/40 truncate">
                {SEGMENT_LABELS[s.type]}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-white tabular-nums">
                {s.amount.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-caption font-semibold text-label/20">{s.pct.toFixed(1)}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
