import React from 'react';
import { FormattedNumber } from 'react-intl';
import { ArrowDownLeft, ArrowUpRight, Shuffle } from 'lucide-react';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { getStatusColor, isRefundPositive } from '../../utils/budgetHelpers';

interface MBudgetMiniCardProps {
  name: string;
  spent: number;
  budget: number;
  isIncome: boolean;
  onClick: () => void;
  storedIsIncome?: boolean; // undefined = Auto, true = Entrée, false = Sortie
  onToggleSens?: () => void;
  expectedPct?: number;
}

export const MBudgetMiniCard: React.FC<MBudgetMiniCardProps> = ({
  name,
  spent,
  budget,
  isIncome,
  onClick,
  storedIsIncome,
  onToggleSens,
  expectedPct,
}) => {
  const meta = getCategoryMeta(name);
  const isSuccess = isIncome && budget > 0 && spent >= budget;
  const progress = budget > 0 ? (spent / budget) * 100 : 0;
  // Dépassement (dépenses uniquement) : la barre plafonne à 100 %, le badge
  // porte l'ampleur du dépassement.
  const overspend = !isIncome && budget > 0 && spent > budget ? spent - budget : 0;

  // Remboursements > dépenses sur une catégorie Sortie : solde positif en vert.
  const refundPositive = isRefundPositive(isIncome, spent);
  const usageColor = refundPositive
    ? '#10b981'
    : isIncome
      ? isSuccess
        ? '#10b981'
        : meta.color
      : getStatusColor(spent, budget);

  return (
    <button
      onClick={onClick}
      className="bg-surface border border-separator rounded-lg px-4 py-2 flex flex-col gap-2 text-left active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-control flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
        >
          <CategoryIcon icon={meta.icon} size={12} />
        </div>
        <span className="text-caption font-bold text-label-tertiary truncate flex-1 min-w-0">
          {name}
        </span>
        {onToggleSens && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSens();
            }}
            title={
              storedIsIncome === true
                ? 'Entrée — clic pour Sortie'
                : storedIsIncome === false
                  ? 'Sortie — clic pour Auto'
                  : 'Auto — clic pour Entrée'
            }
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 border border-separator text-label-secondary active:text-gold active:scale-90 transition-transform shrink-0"
          >
            {storedIsIncome === true ? (
              <ArrowDownLeft size={11} />
            ) : storedIsIncome === false ? (
              <ArrowUpRight size={11} />
            ) : (
              <Shuffle size={11} />
            )}
          </button>
        )}
        <p
          className="text-body font-bold tabular-nums shrink-0"
          style={refundPositive || budget > 0 ? { color: usageColor } : undefined}
        >
          <FormattedNumber
            value={spent}
            style="currency"
            currency="EUR"
            maximumFractionDigits={0}
          />
          {budget > 0 && (
            <span className="text-caption font-bold text-label-tertiary">
              {' / '}
              <FormattedNumber
                value={budget}
                style="currency"
                currency="EUR"
                maximumFractionDigits={0}
              />
            </span>
          )}
        </p>
      </div>

      {budget > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-[3px] flex-1 bg-white/5 rounded-full overflow-hidden relative">
            {expectedPct !== undefined && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
                style={{ left: `${Math.min(100, expectedPct)}%` }}
                title="Rythme théorique"
              />
            )}
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: usageColor }}
            />
          </div>
          {overspend > 0 && (
            <span className="text-caption font-bold tabular-nums text-negative bg-negative/10 rounded-full px-2 py-1 shrink-0">
              +
              <FormattedNumber
                value={overspend}
                style="currency"
                currency="EUR"
                maximumFractionDigits={0}
              />
            </span>
          )}
        </div>
      )}
    </button>
  );
};
