import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingDown } from 'lucide-react';
import { useIntl } from 'react-intl';
import { CHART_COLORS } from '../../lib/colors';
import { fmt } from '../../utils/format';
import type { DerivedRav } from '../../utils/ravCalculations';

interface Props {
  summary: DerivedRav;
  expenseCategoryCount: number;
}

/** Bandeau KPI du Reste-À-Vivre : reste, revenus de référence, dépenses pointées. */
export const RavSummaryBar: React.FC<Props> = ({ summary, expenseCategoryCount }) => {
  const { formatMessage: t } = useIntl();
  const barColor =
    summary.pct < 20 ? CHART_COLORS.ruby : summary.pct < 50 ? CHART_COLORS.gold : '#52B788';
  const textColor = summary.reste >= 0 ? 'text-gold' : 'text-negative';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/5">
      <div className="bg-raised px-6 md:px-8 py-4 lg:col-span-1">
        <div className="text-caption font-semibold text-label/30">
          {t({ id: 'rav.kpi.remaining' })}
        </div>
        <div className={`text-3xl font-serif font-semibold tabular-nums mt-2 ${textColor}`}>
          {fmt(summary.reste)}
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mt-4">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${summary.pct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: barColor, boxShadow: `0 0 12px ${barColor}40` }}
          />
        </div>
      </div>
      <div className="bg-raised px-6 md:px-8 py-4">
        <div className="text-caption font-semibold text-label/30 flex items-center gap-2">
          <Wallet size={10} aria-hidden="true" /> {t({ id: 'rav.kpi.income' })}
        </div>
        <div className="text-2xl font-serif font-semibold text-white tabular-nums mt-2">
          {fmt(summary.revenuRef)}
        </div>
        <div className="text-caption font-semibold text-label/30 mt-1">
          {t({ id: 'rav.kpi.income.hint' })}
        </div>
      </div>
      <div className="bg-raised px-6 md:px-8 py-4">
        <div className="text-caption font-semibold text-label/30 flex items-center gap-2">
          <TrendingDown size={10} aria-hidden="true" /> {t({ id: 'rav.kpi.expenses' })}
        </div>
        <div className="text-2xl font-serif font-semibold text-negative tabular-nums mt-2">
          {fmt(Math.abs(summary.totalDep))}
        </div>
        <div className="text-caption font-semibold text-label/30 mt-1 flex items-center justify-between gap-2">
          <span>
            {expenseCategoryCount > 0
              ? t({ id: 'rav.kpi.expenses.tracking.some' }, { count: expenseCategoryCount })
              : t({ id: 'rav.kpi.expenses.tracking.all' })}
          </span>
          <span className="text-label/40">
            {t({ id: 'rav.kpi.expenses.recurring' }, { amount: fmt(Math.abs(summary.provisions)) })}
          </span>
        </div>
      </div>
    </div>
  );
};
