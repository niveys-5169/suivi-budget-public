import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { formatCurrency } from '../../../lib/formatters';

interface Props {
  income: { actual: number; budget: number };
  expenses: { actual: number; budget: number };
  net: { actual: number; budget: number };
  expectedPct?: number;
}

export const AurumBudgetGlobalFocus: React.FC<Props> = ({ income, expenses, expectedPct }) => {
  const incomePct = income.budget > 0 ? (income.actual / income.budget) * 100 : 0;
  const expensePct = expenses.budget > 0 ? (expenses.actual / expenses.budget) * 100 : 0;

  return (
    <section className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-tr from-gold/10 to-transparent blur-2xl opacity-30" />
      <div className="relative rounded-xl p-10 bg-surface border border-separator backdrop-blur-3xl space-y-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
              <Wallet size={20} />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-white">Focus Trésorerie</h3>
          </div>
          <div className="px-4 py-1 rounded-full bg-white/5 border border-separator text-caption font-semibold text-white/30">
            Flux Consolidés
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10">
          {/* Incomes Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-positive">
              <ArrowUpRight size={14} strokeWidth={3} />
              <span className="text-caption font-semibold">Entrées</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-white">
              {formatCurrency(income.actual)}
            </p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
              {expectedPct !== undefined && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
                  style={{ left: `${Math.min(100, expectedPct)}%` }}
                  title="Rythme théorique"
                />
              )}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(incomePct, 100)}%` }}
                className="h-full bg-positive rounded-full"
              />
            </div>
            <p className="text-caption font-bold text-label-tertiary">
              Cible: {Math.round(incomePct)}%
            </p>
          </div>

          {/* Expenses Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-negative">
              <ArrowDownRight size={14} strokeWidth={3} />
              <span className="text-caption font-semibold">Sorties</span>
            </div>
            <p className="text-xl font-bold tabular-nums text-white">
              {formatCurrency(expenses.actual)}
            </p>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
              {expectedPct !== undefined && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
                  style={{ left: `${Math.min(100, expectedPct)}%` }}
                  title="Rythme théorique"
                />
              )}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(expensePct, 100)}%` }}
                className={`h-full rounded-full ${expensePct > 100 ? 'bg-negative' : 'bg-gold/40'}`}
              />
            </div>
            <p className="text-caption font-bold text-label-tertiary">
              Cible: {Math.round(expensePct)}%
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
