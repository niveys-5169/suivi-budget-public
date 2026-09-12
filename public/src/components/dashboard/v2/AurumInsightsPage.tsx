import React, { useState, useMemo } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import { useDashboard } from '../../../hooks/useDashboard';
import { useSpendingTrends, type TrendWindow } from '../../../hooks/useSpendingTrends';
import { AurumCategoryBreakdown } from './AurumCategoryBreakdown';
import { TrendLineChart } from './TrendLineChart';
import { CategoryDeltaBadge } from './CategoryDeltaBadge';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';

const PERIOD_OPTIONS: { label: string; value: TrendWindow }[] = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
];

const CATEGORY_COLORS = [
  CHART_COLORS.gold,
  CHART_COLORS.ruby,
  CHART_COLORS.emerald,
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
];
import { formatCurrency } from '../../../lib/formatters';

const fmtEur = (n: number) => formatCurrency(n);

export const AurumInsightsPage: React.FC = () => {
  const { stats, filteredTransactions, monthKey, shiftMonth, loading } = useDashboard();
  const [trendWindow, setTrendWindow] = useState<TrendWindow>(6);
  const { breakdown, topIncreases } = useSpendingTrends(trendWindow);

  const categoryStats = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => (Number(t.montant) || 0) < 0);
    const totalExp = Math.abs(expenses.reduce((s, t) => s + (Number(t.montant) || 0), 0));
    const groups: Record<string, number> = {};
    expenses.forEach((t) => {
      const cat = t.categorie || 'Autres';
      groups[cat] = (groups[cat] || 0) + Math.abs(Number(t.montant) || 0);
    });
    return Object.entries(groups)
      .map(([name, amount], i) => ({
        name,
        amount,
        percentage: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]!,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  const [year, month] = monthKey.split('-');
  const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30">
      <div className="fixed top-[-20%] left-[-10%] w-[70%] h-[60%] bg-negative/5 blur-[160px] rounded-full -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-positive/5 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 text-label-tertiary hover:text-gold transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tighter text-white capitalize">{monthName}</h1>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 text-label-tertiary hover:text-gold transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        {/* Period selector */}
        <div className="flex items-center bg-white/5 border border-separator rounded-xl p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTrendWindow(opt.value)}
              className={`px-4 py-2 rounded-lg text-caption font-semibold transition-all ${
                trendWindow === opt.value
                  ? 'bg-gold text-bg shadow shadow-gold/20'
                  : 'text-label/50 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-6 space-y-10 pb-48">
        {/* Income / Expense cards */}
        <section className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl p-6 bg-surface border border-separator backdrop-blur-xl"
          >
            <div className="w-10 h-10 rounded-lg bg-positive/10 border border-positive/20 flex items-center justify-center text-positive mb-4">
              <ArrowUpCircle size={20} />
            </div>
            <p className="text-caption font-semibold text-label-tertiary mb-1">Revenus</p>
            <p className="text-body font-bold text-white tabular-nums">{fmtEur(stats.totalRec)}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-xl p-6 bg-surface border border-separator backdrop-blur-xl"
          >
            <div className="w-10 h-10 rounded-lg bg-negative/10 border border-negative/20 flex items-center justify-center text-negative mb-4">
              <ArrowDownCircle size={20} />
            </div>
            <p className="text-caption font-semibold text-label-tertiary mb-1">Dépenses</p>
            <p className="text-body font-bold text-white tabular-nums">
              {fmtEur(Math.abs(stats.totalDep))}
            </p>
          </motion.div>
        </section>

        {/* Category breakdown — current month */}
        <section className="space-y-8">
          <div className="relative rounded-xl p-10 bg-surface border border-separator backdrop-blur-3xl">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-lg font-bold tracking-tight">Analyse Dépenses</h3>
              <span className="px-4 py-1 rounded-full bg-white/5 border border-separator text-caption font-semibold text-white/40">
                Par Catégorie
              </span>
            </div>
            <AurumCategoryBreakdown stats={categoryStats} />
            <div className="mt-12 pt-10 border-t border-separator flex justify-between items-center">
              <div>
                <p className="text-caption font-semibold text-label-tertiary mb-1">Solde</p>
                <p
                  className={`text-xl font-bold tabular-nums ${stats.solde >= 0 ? 'text-gold' : 'text-negative'}`}
                >
                  {fmtEur(stats.solde)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-caption font-semibold text-label-tertiary mb-1">Transactions</p>
                <p className="text-xl font-bold text-white/40">{filteredTransactions.length}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trend chart */}
        {breakdown.length > 0 && (
          <section className="rounded-xl p-8 bg-surface border border-separator backdrop-blur-3xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold tracking-tight">Tendances</h3>
              <span className="px-4 py-1 rounded-full bg-white/5 border border-separator text-caption font-semibold text-white/40">
                {trendWindow} derniers mois
              </span>
            </div>
            <TrendLineChart breakdown={breakdown} />
          </section>
        )}

        {/* Top increases */}
        {topIncreases.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <TrendingUp size={13} className="text-negative/60" />
              <span className="text-caption font-semibold text-negative/60">
                Top hausses vs mois précédent
              </span>
            </div>
            {topIncreases.map((t, i) => (
              <motion.div
                key={t.category}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center justify-between px-4 py-4 rounded-xl bg-surface border border-separator"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[i] }}
                  />
                  <span className="text-sm font-bold text-white truncate">{t.category}</span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <span className="text-sm font-serif font-bold text-white/50 tabular-nums">
                    {fmtEur(t.current)}
                  </span>
                  <CategoryDeltaBadge deltaPct={t.deltaPct} />
                </div>
              </motion.div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};
