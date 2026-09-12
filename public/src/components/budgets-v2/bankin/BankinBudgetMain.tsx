import React, { useMemo } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { fmt } from '../../../utils/format';
import { getExpectedPaceProgress } from '../../../utils/date';
import { MonthNavigator } from '../../shared/MonthNavigator';
import { BankinBudgetGrid } from './BankinBudgetGrid';

import { CategoryDetail } from './BankinBudgetsContainer';

interface Props {
  netBalance: number;
  totalSpent: number;
  totalReceived: number;
  totalBudget: number; // Budget total des dépenses
  totalIncomeBudget?: number; // Optionnel : Budget total des revenus
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  incomeCategories: CategoryDetail[];
  expenseCategories: CategoryDetail[];
  chartData: { day: number; amount: number }[];
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  viewMode: 'monthly' | 'annual';
}

export const BankinBudgetMain: React.FC<Props> = ({
  netBalance,
  totalSpent,
  totalReceived,
  totalBudget,
  totalIncomeBudget = 0,
  currentMonth,
  onMonthChange,
  incomeCategories,
  expenseCategories,
  chartData,
  onCategoryClick,
  onToggleSens,
  viewMode,
}) => {
  const remaining = Math.max(0, totalBudget - totalSpent);
  const isOver = totalBudget > 0 && totalSpent > totalBudget;
  const progress = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  // Expected progress at this point in time, si on suivait un rythme constant
  const expectedProgress = useMemo(() => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    return getExpectedPaceProgress(viewMode === 'annual' ? 'annual' : 'monthly', monthKey);
  }, [viewMode, currentMonth]);

  // Theoretical line data for the chart
  const theoreticalChartData = useMemo(() => {
    const maxDay = viewMode === 'monthly' ? 31 : 12;
    // En mode détail catégorie (pas de grilles de catégories), afficher la cible budgétaire cumulative
    const isCategoryDetail = incomeCategories.length === 0 && expenseCategories.length === 0;
    if (isCategoryDetail) {
      return Array.from({ length: maxDay }, (_, i) => ({
        day: i + 1,
        theoretical: (totalBudget / maxDay) * (i + 1),
      }));
    }
    if (!chartData.length) return [];
    const targetRevenue = totalIncomeBudget > 0 ? totalIncomeBudget : totalReceived;
    const totalNetBudget = targetRevenue - totalBudget;
    return Array.from({ length: maxDay }, (_, i) => ({
      day: i + 1,
      theoretical: (totalNetBudget / maxDay) * (i + 1),
    }));
  }, [
    chartData,
    totalBudget,
    totalReceived,
    totalIncomeBudget,
    viewMode,
    incomeCategories.length,
    expenseCategories.length,
  ]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="space-y-6">
        <MonthNavigator month={currentMonth} onChange={onMonthChange} />

        <div className="text-center space-y-4">
          <div className="flex flex-col items-center">
            <span className="text-caption font-bold text-label-tertiary mb-1">
              Solde Net {viewMode === 'monthly' ? 'du mois' : 'YTD (Annuel)'}
            </span>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-5xl font-serif font-semibold tracking-tight [font-variant-numeric:tabular-nums] ${netBalance >= 0 ? 'text-gold' : 'text-negative'}`}
            >
              {fmt(netBalance)}
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-caption font-semibold text-positive">
                {viewMode === 'monthly' ? 'Encaissé' : 'Encaissé YTD'}
              </span>
              <span className="text-sm font-bold text-positive">+{fmt(totalReceived)}</span>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="flex flex-col items-center">
              <span className="text-caption font-semibold text-gold/60">
                {viewMode === 'monthly' ? 'Dépensé' : 'Dépensé YTD'}
              </span>
              <span className="text-sm font-bold text-label">-{fmt(totalSpent)}</span>
            </div>
          </div>
        </div>

        {/* Progress Bar (Dépenses) */}
        <div className="px-4">
          <div className="flex justify-between mb-2 px-1">
            <span className="text-caption font-semibold text-label-tertiary">
              Maîtrise des dépenses
            </span>
            <span className="text-caption font-semibold text-label-tertiary">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-separator shadow-inner relative">
            {/* Reference line (Today's expected progress) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
              style={{ left: `${expectedProgress}%` }}
              title="Rythme théorique"
            />

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${isOver ? 'bg-negative shadow-[0_0_15px_rgba(185,28,28,0.4)]' : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]'}`}
            />
          </div>
          <div className="flex justify-between mt-4 px-1">
            <div className="flex flex-col">
              <span className="text-caption font-semibold text-label-tertiary">
                {viewMode === 'monthly' ? 'Budget total' : 'Budget annuel'}
              </span>
              <span className="text-sm font-bold text-label/80">{fmt(totalBudget)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-caption font-semibold text-label-tertiary">
                {viewMode === 'monthly' ? 'Restant' : 'Reliquat annuel'}
              </span>
              <span className={`text-sm font-bold ${isOver ? 'text-negative' : 'text-positive'}`}>
                {fmt(remaining)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area Chart */}
      <div className="px-2">
        <div className="bg-surface rounded-xl p-6 h-[200px] border border-separator">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.03)"
              />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#52525b', fontSize: 10, fontWeight: 'bold' }}
                minTickGap={viewMode === 'monthly' ? 20 : 0}
                tickFormatter={(val) => (viewMode === 'monthly' ? val : `M${val}`)}
              />
              <YAxis hide domain={['auto', 'auto']} />
              {/* Vertical line for today (monthly) or current month (annual) */}
              {viewMode === 'monthly' && (
                <ReferenceLine
                  x={new Date().getDate()}
                  stroke="rgba(212, 175, 55, 0.3)"
                  strokeDasharray="3 3"
                  label={{
                    position: 'top',
                    value: "Aujourd'hui",
                    fill: 'rgba(212, 175, 55, 0.4)',
                    fontSize: 8,
                    fontWeight: 'black',
                    offset: 10,
                  }}
                />
              )}
              {viewMode === 'annual' && (
                <ReferenceLine
                  x={new Date().getMonth() + 1}
                  stroke="rgba(212, 175, 55, 0.3)"
                  strokeDasharray="3 3"
                  label={{
                    position: 'top',
                    value: 'Mois actuel',
                    fill: 'rgba(212, 175, 55, 0.4)',
                    fontSize: 8,
                    fontWeight: 'black',
                    offset: 10,
                  }}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B0B14',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                itemStyle={{ color: CHART_COLORS.gold }}
                formatter={(value) => [fmt(Number(value)), 'Cumulé Net']}
                labelFormatter={(label) =>
                  viewMode === 'monthly' ? `Jour ${label}` : `Mois ${label}`
                }
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke={CHART_COLORS.gold}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSpent)"
                isAnimationActive={false}
              />
              <Area
                data={theoreticalChartData}
                type="monotone"
                dataKey="theoretical"
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="5 5"
                fill="transparent"
                strokeWidth={1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Categories sections */}
      <div className="px-4 space-y-10">
        {/* Revenus */}
        {incomeCategories.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-caption font-semibold text-positive">Revenus & Rentrees</h3>
              <span className="text-caption font-bold text-label-tertiary">
                {incomeCategories.length} catégories
              </span>
            </div>
            <BankinBudgetGrid
              categories={incomeCategories}
              onCategoryClick={onCategoryClick}
              onToggleSens={onToggleSens}
              expectedPct={expectedProgress}
            />
          </div>
        )}

        {/* Dépenses */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-caption font-semibold text-gold/80">Dépenses & Budgets</h3>
            <span className="text-caption font-bold text-label-tertiary">
              {expenseCategories.length} catégories
            </span>
          </div>
          <BankinBudgetGrid
            categories={expenseCategories}
            onCategoryClick={onCategoryClick}
            onToggleSens={onToggleSens}
            expectedPct={expectedProgress}
          />
        </div>

        <div className="flex justify-center pb-8">
          <button className="text-caption font-semibold text-gold hover:text-white transition-colors border border-gold/20 px-6 py-2 rounded-full hover:bg-gold/5">
            Voir l&apos;historique complet
          </button>
        </div>
      </div>
    </div>
  );
};
