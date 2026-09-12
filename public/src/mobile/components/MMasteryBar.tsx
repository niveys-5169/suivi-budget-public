import React from 'react';
import { FormattedNumber } from 'react-intl';
import { motion } from 'framer-motion';

interface MMasteryBarProps {
  progress: number;
  viewMode: 'monthly' | 'annual';
  totalBudget: number;
  totalSpent: number;
  expectedProgress: number;
}

export const MMasteryBar: React.FC<MMasteryBarProps> = ({
  progress,
  viewMode,
  totalBudget,
  totalSpent,
  expectedProgress,
}) => {
  const isOver = progress > 100;
  const remaining = Math.max(0, totalBudget - totalSpent);

  return (
    <div className="px-4 pb-6">
      <div className="flex justify-between items-end mb-2">
        <span className="text-caption font-bold text-label-tertiary">Maîtrise des dépenses</span>
        <span
          className={`text-footnote font-bold ${isOver ? 'text-negative' : 'text-label-secondary'}`}
        >
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden relative border border-separator">
        {/* Expected progress line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
          style={{ left: `${expectedProgress}%` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${isOver ? 'bg-negative shadow-[0_0_10px_rgba(185,28,28,0.3)]' : 'bg-gold shadow-gold-dot'}`}
        />
      </div>

      <div className="flex justify-between mt-4">
        <div className="flex flex-col">
          <span className="text-caption font-bold text-label-tertiary">
            {viewMode === 'monthly' ? 'Budget total' : 'Budget annuel'}
          </span>
          <span className="text-footnote font-bold text-label/80 tabular-nums">
            <FormattedNumber
              value={totalBudget}
              style="currency"
              currency="EUR"
              maximumFractionDigits={0}
            />
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-caption font-bold text-label-tertiary">
            {viewMode === 'monthly' ? 'Restant' : 'Reliquat annuel'}
          </span>
          <span
            className={`text-footnote font-bold tabular-nums ${isOver ? 'text-negative' : 'text-positive'}`}
          >
            <FormattedNumber
              value={remaining}
              style="currency"
              currency="EUR"
              maximumFractionDigits={0}
            />
          </span>
        </div>
      </div>
    </div>
  );
};
