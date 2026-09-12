import React from 'react';
import { FormattedNumber } from 'react-intl';
import { motion } from 'framer-motion';

interface MBudgetHeroProps {
  netBalance: number;
  label: string;
  totalReceived?: number;
  totalSpent?: number;
}

export const MBudgetHero: React.FC<MBudgetHeroProps> = ({
  netBalance,
  label,
  totalReceived,
  totalSpent,
}) => {
  const isPositive = netBalance >= 0;
  const showBreakdown = totalReceived !== undefined && totalSpent !== undefined;

  return (
    <section className="px-4 py-6 flex flex-col items-center justify-center text-center">
      <span className="text-caption font-bold text-label-tertiary mb-1">{label}</span>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-display font-bold tracking-tight flex items-center tabular-nums
          ${isPositive ? 'text-gold' : 'text-negative'}`}
      >
        <FormattedNumber
          value={netBalance}
          style="currency"
          currency="EUR"
          signDisplay="exceptZero"
        />
      </motion.h2>

      {showBreakdown && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-caption font-bold text-positive">Encaissé</span>
            <span className="text-footnote font-bold text-positive tabular-nums">
              +
              <FormattedNumber
                value={totalReceived}
                style="currency"
                currency="EUR"
                maximumFractionDigits={0}
              />
            </span>
          </div>
          <div className="w-px h-8 bg-white/5" />
          <div className="flex flex-col items-center">
            <span className="text-caption font-bold text-gold/60">Dépensé</span>
            <span className="text-footnote font-bold text-label tabular-nums">
              -
              <FormattedNumber
                value={totalSpent}
                style="currency"
                currency="EUR"
                maximumFractionDigits={0}
              />
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
