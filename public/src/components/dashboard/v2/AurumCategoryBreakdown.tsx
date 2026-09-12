import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../../../lib/formatters';

interface CategoryStat {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface Props {
  stats: CategoryStat[];
}

export const AurumCategoryBreakdown: React.FC<Props> = ({ stats }) => {
  return (
    <div className="space-y-6">
      {stats
        .sort((a, b) => b.amount - a.amount)
        .map((cat, i) => (
          <motion.div
            key={cat.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="space-y-2"
          >
            <div className="flex justify-between items-end px-1">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-footnote font-semibold text-white tracking-tight">
                  {cat.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-footnote font-bold text-white tabular-nums">
                  {formatCurrency(cat.amount)}
                </span>
                <span className="text-caption font-semibold text-label-tertiary ml-2">
                  {cat.percentage}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cat.percentage}%` }}
                transition={{ duration: 1, delay: i * 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            </div>
          </motion.div>
        ))}
    </div>
  );
};
