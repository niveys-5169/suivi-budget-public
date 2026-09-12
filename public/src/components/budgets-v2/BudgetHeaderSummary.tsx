import React from 'react';
import { formatCurrency } from '../../lib/formatters';

interface BudgetHeaderSummaryProps {
  budgetTotal: number;
  spentToDate: number;
  remaining: number;
  consumedPct: number;
  expectedPct?: number;
}

export const BudgetHeaderSummary: React.FC<BudgetHeaderSummaryProps> = ({
  budgetTotal,
  spentToDate,
  remaining,
  consumedPct,
  expectedPct,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 px-2 md:px-4">
      <div className="md:col-span-2 bg-white/5 rounded-lg border border-separator p-6 md:p-8 flex flex-col justify-between">
        <p className="text-caption font-semibold text-label/40 mb-4">Consommation Globale</p>
        <div className="flex items-end justify-between mb-4">
          <p className="text-4xl md:text-5xl font-bold text-white tabular-nums">
            {Math.round(consumedPct)}
            <span className="text-2xl text-label/40 font-light">%</span>
          </p>
          <div className="text-right">
            <p className="text-lg md:text-xl font-bold text-white tabular-nums">
              {formatCurrency(spentToDate)}
            </p>
            <p className="text-caption font-semibold text-label/20 mt-1">
              Sur {formatCurrency(budgetTotal)}
            </p>
          </div>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
          {expectedPct !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
              style={{ left: `${Math.min(100, expectedPct)}%` }}
              title="Rythme théorique"
            />
          )}
          <div
            className={`h-full transition-all duration-1000 ${consumedPct > 100 ? 'bg-negative' : 'bg-label'}`}
            style={{ width: `${Math.min(100, consumedPct)}%` }}
          />
        </div>
      </div>

      <div className="bg-white/5 rounded-lg border border-separator p-6 md:p-8">
        <p className="text-caption font-semibold text-label/40 mb-4">Restant</p>
        <p
          className={`text-2xl md:text-3xl font-bold tabular-nums ${remaining < 0 ? 'text-negative' : 'text-white'}`}
        >
          {formatCurrency(remaining)}
        </p>
      </div>

      <div className="bg-white/5 rounded-lg border border-separator p-6 md:p-8">
        <p className="text-caption font-semibold text-label/40 mb-4">Budget Total</p>
        <p className="text-2xl md:text-3xl font-bold text-white tabular-nums">
          {formatCurrency(budgetTotal)}
        </p>
      </div>
    </div>
  );
};
