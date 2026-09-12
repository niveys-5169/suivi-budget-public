import React, { useMemo, useState } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import { motion } from 'framer-motion';
import { Target, Activity, BarChart3, Edit3, Save } from 'lucide-react';
import { Modal } from '../../shared/Modal';
import { AurumRecentTransactions } from './AurumRecentTransactions';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useBudget } from '../../../hooks/useBudget';
import { useTransactionContext } from '../../../context/TransactionContext';
import { Transaction } from '../../../types/banking.types';
import { formatCurrency } from '../../../lib/formatters';
import { parseDecimal } from '../../../utils/format';

interface Props {
  category: string;
  spent: number;
  budget: number;
  transactions: Transaction[];
  timeProgress: number;
  viewMode: 'monthly' | 'annual';
  onClose: () => void;
  onTransactionClick: (id: string) => void;
}

export const AurumBudgetDetail: React.FC<Props> = ({
  category,
  spent,
  budget,
  transactions,
  timeProgress,
  viewMode,
  onClose,
  onTransactionClick,
}) => {
  const { updateMonthlyBudget, updateAnnualDefault, updateBaseBudget } = useBudget();
  const { togglePointe } = useTransactionContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budget.toString());
  const [saving, setSaving] = useState(false);

  const budgetProgress = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverSpeed = budgetProgress > timeProgress;

  const handleSave = async () => {
    setSaving(true);
    try {
      const val = parseDecimal(editValue) ?? 0;
      if (viewMode === 'monthly') {
        await Promise.all([
          updateMonthlyBudget(category, val),
          updateBaseBudget(category, val, 'mensuel'),
        ]);
      } else {
        await updateAnnualDefault(category, val);
        await updateBaseBudget(category, val, 'annuel');
      }
      setIsEditing(false);
    } catch (err) {
      console.error('[AurumBudgetDetail] Failed to save budget:', err);
    } finally {
      setSaving(false);
    }
  };

  const chartData = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let cum = 0;
    if (viewMode === 'annual') {
      const monthMap: Record<number, number> = {};
      sorted.forEach((t) => {
        const m = new Date(t.date).getMonth() + 1;
        monthMap[m] = (monthMap[m] || 0) + Math.abs(Number(t.montant) || 0);
      });
      const currentMonth = new Date().getMonth() + 1;
      return Array.from({ length: 12 }, (_, i) => {
        cum += monthMap[i + 1] || 0;
        return { day: i + 1, amount: cum };
      }).filter((d) => d.day <= currentMonth || d.amount > 0);
    }
    const data = sorted.map((t) => {
      cum += Math.abs(Number(t.montant) || 0);
      return { day: new Date(t.date).getDate(), amount: cum };
    });
    if (data.length > 0) data.push({ day: 31, amount: cum });
    return data;
  }, [transactions, viewMode]);

  const fmtEur = (n: number) => formatCurrency(n);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={category}
      subtitle="Pilotage Catégorie"
      size="md"
      variant="centered"
    >
      <div className="p-8 space-y-8">
        {/* Category icon */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-control bg-gold/10 border border-gold/20 flex items-center justify-center text-gold flex-shrink-0">
            <Target size={32} />
          </div>
          <div>
            <p className="text-caption font-semibold text-label-tertiary">Pilotage Catégorie</p>
            <h3 className="text-2xl font-bold tracking-tight text-white">{category}</h3>
          </div>
        </div>

        {/* Rhythm section */}
        <section className="p-6 rounded-card bg-surface border border-separator space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-caption font-semibold text-label-tertiary mb-1">Consommé</p>
              <p className="text-3xl font-serif font-bold text-white [font-variant-numeric:tabular-nums]">
                {fmtEur(spent)}
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center justify-end gap-2">
                <p className="text-caption font-semibold text-label-tertiary">
                  Budget {viewMode === 'monthly' ? 'Mois' : 'Année'}
                </p>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-gold/40 hover:text-gold transition-colors min-h-[44px] min-w-[44px] grid place-items-center"
                  aria-label="Modifier le budget"
                >
                  <Edit3 size={14} />
                </button>
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-24 bg-white/5 border border-gold/30 rounded-control px-2 py-1 text-right text-base font-bold text-gold outline-none focus:ring-1 focus:ring-gold/40"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="min-h-[44px] min-w-[44px] grid place-items-center rounded-control bg-gold text-bg hover:bg-gold-light transition-all disabled:opacity-50"
                    aria-label="Enregistrer"
                  >
                    <Save size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-lg font-bold text-white/60 [font-variant-numeric:tabular-nums]">
                  {fmtEur(budget)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative h-4 w-full bg-white/5 rounded-full overflow-hidden border border-separator">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10 shadow-[0_0_10px_white]"
                style={{ left: `${timeProgress}%` }}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetProgress, 100)}%` }}
                className={`h-full rounded-full ${isOverSpeed ? 'bg-negative shadow-[0_0_20px_rgba(185,28,28,0.4)]' : 'bg-gold shadow-[0_0_20px_rgba(212,175,55,0.4)]'}`}
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${isOverSpeed ? 'bg-negative animate-pulse' : 'bg-positive'}`}
                />
                <span className="text-caption font-semibold text-white/30">
                  {isOverSpeed ? 'En survitesse' : 'Rythme optimal'}
                </span>
              </div>
              <span className="text-caption font-semibold text-white/30">
                Jalon temps : {timeProgress.toFixed(0)}%
              </span>
            </div>
          </div>
        </section>

        {/* Chart */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <BarChart3 size={18} className="text-gold" />
            <h4 className="text-base font-bold tracking-tight text-white">Évolution Dépenses</h4>
          </div>
          <div className="h-40 w-full bg-surface border border-separator rounded-card p-4 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="budgetDetailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isOverSpeed ? CHART_COLORS.ruby : CHART_COLORS.gold}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={isOverSpeed ? CHART_COLORS.ruby : CHART_COLORS.gold}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#52525b', fontSize: 9, fontWeight: 'bold' }}
                  tickFormatter={(v) => (viewMode === 'annual' ? `M${v}` : String(v))}
                  hide={viewMode === 'monthly'}
                />
                <YAxis hide domain={[0, Math.max(budget, spent) * 1.1]} />
                {viewMode === 'annual' && (
                  <ReferenceLine
                    x={new Date().getMonth() + 1}
                    stroke="rgba(212, 175, 55, 0.4)"
                    strokeDasharray="3 3"
                    label={{
                      position: 'top',
                      value: 'Actuel',
                      fill: 'rgba(212, 175, 55, 0.5)',
                      fontSize: 8,
                      fontWeight: 'bold',
                    }}
                  />
                )}
                {viewMode === 'annual' && budget > 0 && (
                  <Area
                    data={Array.from({ length: 12 }, (_, i) => ({
                      day: i + 1,
                      target: (budget / 12) * (i + 1),
                    }))}
                    type="linear"
                    dataKey="target"
                    stroke="rgba(255,255,255,0.15)"
                    strokeDasharray="4 4"
                    fill="transparent"
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                )}
                <Area
                  type={viewMode === 'annual' ? 'monotone' : 'stepAfter'}
                  dataKey="amount"
                  stroke={isOverSpeed ? CHART_COLORS.ruby : CHART_COLORS.gold}
                  strokeWidth={3}
                  fill="url(#budgetDetailGrad)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Transactions */}
        <section className="space-y-4 pb-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-gold" />
              <h4 className="text-base font-bold tracking-tight text-white">Flux du mois</h4>
            </div>
            <span className="text-caption font-semibold text-label-tertiary">
              {transactions.length} flux
            </span>
          </div>
          <AurumRecentTransactions
            transactions={transactions.map((t) => ({
              ...t,
              id: t.id,
              libelle: t.libelle || 'Transaction',
              montant: t.montant ?? 0,
              date: t.date || '',
              categorie: t.categorie,
              pointe: t.pointe,
            }))}
            onTransactionClick={onTransactionClick}
            onTogglePointe={togglePointe}
          />
        </section>
      </div>
    </Modal>
  );
};
