import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { fmt } from '../../utils/format';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { CategoryIcon } from '../CategoryIcon';

interface Props {
  name: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
  isActive: boolean;
  isHidden: boolean;
  onClick: () => void;
  onToggleHide: (e: React.MouseEvent) => void;
}

export const AnalyseCategoryRow = React.forwardRef<HTMLDivElement, Props>(
  ({ name, amount, percentage, count, color, isActive, isHidden, onClick, onToggleHide }, ref) => {
    const meta = getCategoryMeta(name);

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className={[
          'flex items-center gap-4 p-4 transition-all cursor-pointer group rounded-lg',
          isActive ? 'bg-white/8 ring-1 ring-inset' : 'hover:bg-white/5',
          isHidden ? 'opacity-40' : '',
        ].join(' ')}
        style={isActive ? ({ ringColor: `${color}40` } as React.CSSProperties) : undefined}
      >
        {/* Icône catégorie */}
        <div
          className="w-10 h-10 flex items-center justify-center rounded-xl border shrink-0 transition-all"
          style={{
            backgroundColor: isActive ? `${color}20` : `${color}10`,
            borderColor: isActive ? `${color}60` : `${color}30`,
            color,
          }}
        >
          <CategoryIcon icon={meta.icon} size={18} color={color} />
        </div>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span
              className="font-bold truncate transition-colors"
              title={name}
              style={{ color: isActive ? color : undefined }}
            >
              {isHidden ? (
                <s className="text-label-tertiary">{name}</s>
              ) : (
                <span className="text-label">{name}</span>
              )}
            </span>
            <span
              className={[
                'font-serif font-semibold [font-variant-numeric:tabular-nums] ml-2',
                isHidden ? 'line-through text-label-tertiary' : 'text-label',
              ].join(' ')}
            >
              {fmt(amount)}
            </span>
          </div>

          <div className="flex items-center justify-between text-caption font-bold text-label-tertiary">
            <span>
              {count} {count > 1 ? 'transactions' : 'transaction'}
            </span>
            {!isHidden && <span className="text-label-secondary">{percentage.toFixed(0)} %</span>}
          </div>

          {/* Barre de progression */}
          {!isHidden && (
            <div className="mt-2 h-0.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                  opacity: isActive ? 1 : 0.5,
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle visibilité */}
          <button
            onClick={onToggleHide}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-label-tertiary hover:text-label-secondary hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={isHidden ? 'Afficher dans le total' : 'Masquer du total'}
            aria-label={isHidden ? 'Afficher' : 'Masquer'}
          >
            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>

          <ChevronRight
            size={16}
            className={[
              'transition-colors',
              isActive ? 'text-gold' : 'text-label-tertiary group-hover:text-gold',
            ].join(' ')}
          />
        </div>
      </motion.div>
    );
  },
);

AnalyseCategoryRow.displayName = 'AnalyseCategoryRow';
