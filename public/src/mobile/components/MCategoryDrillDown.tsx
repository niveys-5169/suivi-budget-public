import React from 'react';
import { ChevronLeft, TrendingUp } from 'lucide-react';
import { FormattedNumber } from 'react-intl';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { BudgetTrendChart } from '../../components/budgets-v2/BudgetTrendChart';
import type { Transaction } from '../../hooks/useTransactions';

interface MCategoryDrillDownProps {
  categoryName: string;
  transactions: Transaction[];
  color: string;
  totalSpent: number;
  budget?: number;
  periodeDebut?: string;
  periodeFin?: string;
  onBack?: () => void;
  onTransactionClick?: (transaction: Transaction) => void;
  onEditBudget?: () => void;
}

export const MCategoryDrillDown: React.FC<MCategoryDrillDownProps> = ({
  categoryName,
  transactions,
  color,
  totalSpent,
  budget = 0,
  periodeDebut,
  periodeFin,
  onBack,
  onTransactionClick,
  onEditBudget,
}) => {
  const meta = getCategoryMeta(categoryName);
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // Graphique du rythme de dépenses vs atterrissage fin de période (cible budgétaire).
  // Affiché uniquement quand un budget cible et une période sont disponibles.
  const showTrend = budget > 0 && !!periodeDebut && !!periodeFin;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg border-b border-separator">
        {/* Pas de pt-safe ici : le <main> de MobileShell applique déjà le safe-area top */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-label" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-headline font-semibold text-label">{categoryName}</h2>
            <p className="text-footnote text-label-secondary">
              {transactions.length} transaction(s)
            </p>
          </div>
        </div>

        {/* Total card */}
        <div className="px-4 pb-4">
          <div className="bg-white/5 rounded-lg p-4 border border-separator">
            <p className="text-footnote text-label-tertiary mb-1">Total</p>
            <p className="text-2xl font-bold text-white">
              <FormattedNumber value={Math.abs(totalSpent)} style="currency" currency="EUR" />
            </p>
          </div>
        </div>
      </div>

      {/* Transactions list */}
      <div className="flex-1 overflow-y-auto">
        {showTrend && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <TrendingUp size={14} className="text-gold" />
              <h3 className="text-caption font-semibold text-gold">Rythme de dépenses</h3>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-separator">
              <BudgetTrendChart
                consumption={{
                  periodeDebut: periodeDebut as string,
                  periodeFin: periodeFin as string,
                  montant: budget,
                }}
                transactions={transactions.map((t) => ({
                  date: t.date,
                  montant: t.montant ?? 0,
                }))}
              />
              <p className="mt-2 text-footnote text-label-tertiary text-center">
                Ligne pointillée = rythme cible pour atterrir sur le budget en fin de période
              </p>
            </div>
          </div>
        )}

        <div className="divide-y divide-separator">
          {sorted.map((tx) => (
            <button
              key={tx.id}
              onClick={() => onTransactionClick?.(tx)}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-white/5 transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <CategoryIcon icon={meta.icon} size={16} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-body font-medium text-white truncate">{tx.libelle}</p>
                <p className="text-footnote text-label-tertiary">{tx.date}</p>
              </div>

              <p
                className={`text-body font-bold tabular-nums shrink-0 ${
                  (tx.montant || 0) >= 0 ? 'text-positive' : 'text-negative'
                }`}
              >
                <FormattedNumber value={tx.montant || 0} style="currency" currency="EUR" />
              </p>
            </button>
          ))}

          {sorted.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-footnote text-label-tertiary">Aucune transaction</p>
            </div>
          )}
        </div>

        {onEditBudget && (
          <div className="px-4 py-6">
            <button
              onClick={onEditBudget}
              className="w-full py-4 rounded-lg bg-gold text-bg text-caption font-semibold active:scale-[0.98] transition-transform"
            >
              Éditer le budget
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
