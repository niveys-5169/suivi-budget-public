import React from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import { fmt } from '../../../utils/format';
import { getCategoryMeta } from '../../../constants/categoryMetadata';
import { CategoryIcon } from '../../CategoryIcon';
import type { Transaction } from '../../../hooks/useTransactions';

interface Props {
  categoryName: string;
  transactions: Transaction[];
  color: string;
  totalSpent: number;
  budget?: number;
  onTransactionClick?: (transaction: Transaction) => void;
}

export const CategoryDrillDown: React.FC<Props> = ({
  categoryName,
  transactions,
  color,
  totalSpent,
  budget,
  onTransactionClick,
}) => {
  const meta = getCategoryMeta(categoryName);
  const budgetPct = budget && budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
  const isExceeded = !!budget && totalSpent > budget;

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="px-4 md:px-6 space-y-6 pt-6 pb-12">
      {/* Category header */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-lg border flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20`, borderColor: `${color}50`, color }}
          >
            <CategoryIcon icon={meta.icon} size={24} />
          </div>
          <div>
            <p className="font-bold text-label text-lg">{categoryName}</p>
            <p className="text-caption font-bold text-label-tertiary">
              {transactions.length} transaction{transactions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <p
          className="font-serif text-4xl font-semibold [font-variant-numeric:tabular-nums]"
          style={{ color }}
        >
          {fmt(totalSpent)}
        </p>

        {/* Budget progress */}
        {budget && budget > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-caption font-bold">
              <span className="text-label-tertiary">Budget</span>
              <span className={isExceeded ? 'text-negative' : 'text-label-secondary'}>
                {fmt(budget)} • {budgetPct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${budgetPct}%`,
                  backgroundColor: isExceeded ? CHART_COLORS.ruby : color,
                }}
              />
            </div>
            {isExceeded && (
              <p className="text-caption font-bold text-negative">
                Dépassement : {fmt(totalSpent - budget)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div>
        <h3 className="text-caption font-bold text-label-tertiary px-2 mb-4">Transactions</h3>
        <div className="divide-y divide-separator">
          {sorted.map((tx) => (
            <button
              key={tx.id}
              onClick={() => onTransactionClick?.(tx)}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-label text-sm truncate" title={tx.libelle}>
                  {tx.libelle}
                </p>
                <p className="text-caption font-bold text-label-tertiary mt-1">{tx.date}</p>
              </div>
              <p
                className={`font-serif font-semibold text-sm [font-variant-numeric:tabular-nums] shrink-0 ${
                  (tx.montant || 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                {fmt(tx.montant || 0)}
              </p>
            </button>
          ))}
          {sorted.length === 0 && (
            <div className="py-12 text-center text-label-tertiary text-sm">Aucune transaction</div>
          )}
        </div>
      </div>
    </div>
  );
};
