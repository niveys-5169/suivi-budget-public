import React from 'react';
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { ArrowDownLeft, ArrowUpRight, GripVertical, Shuffle } from 'lucide-react';
import { CategoryIcon } from '../../CategoryIcon';
import { getCategoryMeta } from '../../../constants/categoryMetadata';
import { getStatusColor, isRefundPositive } from '../../../utils/budgetHelpers';
import { fmt } from '../../../utils/format';
import { IconButton } from '../../../ui';

interface Props {
  name: string;
  spent: number;
  budget: number;
  onClick: () => void;
  isIncome?: boolean;
  storedIsIncome?: boolean; // undefined=Auto, true=Entrée, false=Sortie
  onToggleSens?: () => void;
  expectedPct?: number;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  };
}

export const BankinBudgetCard: React.FC<Props> = ({
  name,
  spent,
  budget,
  onClick,
  isIncome = false,
  storedIsIncome,
  onToggleSens,
  expectedPct,
  dragHandleProps,
}) => {
  const meta = getCategoryMeta(name);

  // Pour les revenus, dépasser est bien. Pour les dépenses, c'est mal.
  const isSuccess = isIncome && budget > 0 && spent >= budget;
  const progress = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  // Remboursements > dépenses sur une catégorie Sortie : solde positif en vert.
  const refundPositive = isRefundPositive(isIncome, spent);
  // Code couleur : vert si positif-net, vert si revenu atteint, sinon rouge/orange/vert standard.
  const usageColor = refundPositive
    ? '#10b981'
    : isIncome
      ? isSuccess
        ? '#10b981'
        : meta.color
      : getStatusColor(spent, budget);

  const amountStyle = refundPositive || budget > 0 ? { color: usageColor } : undefined;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="bg-surface px-4 py-4 rounded-lg border border-separator hover:border-separator transition-all cursor-pointer group active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
        {dragHandleProps && (
          <IconButton
            label="Glisser pour réordonner"
            variant="plain"
            size="sm"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
          >
            <GripVertical size={14} />
          </IconButton>
        )}
        <div
          className="w-9 h-9 flex items-center justify-center rounded-xl border shrink-0"
          style={{
            backgroundColor: `${meta.color}10`,
            borderColor: `${meta.color}30`,
            color: meta.color,
          }}
        >
          <CategoryIcon icon={meta.icon} size={16} />
        </div>

        <span
          data-testid="category-name"
          title={name}
          className="font-bold text-xs text-label/90 truncate flex-1 min-w-0"
        >
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
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-lg bg-surface border border-separator text-label-tertiary hover:text-gold hover:border-gold/40 shrink-0"
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

        <div className="flex items-baseline gap-1 shrink-0">
          <span
            className="text-base font-serif font-semibold [font-variant-numeric:tabular-nums] tracking-tight"
            style={amountStyle}
          >
            {fmt(spent)}
          </span>
          {budget > 0 && (
            <span className="text-caption font-semibold text-label-tertiary">/ {fmt(budget)}</span>
          )}
        </div>
      </div>

      {budget > 0 && (
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-4 relative">
          {expectedPct !== undefined && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
              style={{ left: `${Math.min(100, expectedPct)}%` }}
              title="Rythme théorique"
            />
          )}
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, backgroundColor: usageColor }}
          />
        </div>
      )}
    </div>
  );
};
