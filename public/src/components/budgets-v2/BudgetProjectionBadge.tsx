import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useBudgetProjection } from '../../hooks/useBudgetProjection';
import type { BudgetPeriodMode } from '../../context/AppStateContext';

interface BudgetProjectionBadgeProps {
  categoryId: string;
  viewMode: 'monthly' | 'annual';
  monthKey: string;
}

export const BudgetProjectionBadge: React.FC<BudgetProjectionBadgeProps> = ({
  categoryId,
  viewMode,
  monthKey,
}) => {
  const periodMode: BudgetPeriodMode = viewMode === 'annual' ? 'year' : 'month';
  const { status, varianceProjected } = useBudgetProjection(categoryId, periodMode, monthKey);

  if (status === 'ok') return null;

  if (status === 'watch') {
    return (
      <span
        role="status"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 border border-gold/20 text-gold text-caption font-semibold"
      >
        <TrendingUp size={9} />
        Risque
      </span>
    );
  }

  // risk
  const overrun = Math.abs(varianceProjected);
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-negative/10 border border-negative/20 text-negative text-caption font-semibold"
    >
      <TrendingUp size={9} />+{overrun.toFixed(0)} €
    </span>
  );
};
