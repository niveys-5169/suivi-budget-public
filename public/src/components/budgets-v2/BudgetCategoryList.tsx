import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

export interface BudgetCategoryRowVM {
  categoryId: string;
  label: string;
  spent: number;
  limit: number;
  consumedPct: number;
  theoreticalPct?: number;
  remaining: number;
  status: 'ok' | 'watch' | 'risk';
}

interface BudgetCategoryListProps {
  rows: BudgetCategoryRowVM[];
  onOpenCategory: (id: string) => void;
}

export const BudgetCategoryList: React.FC<BudgetCategoryListProps> = ({ rows, onOpenCategory }) => {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid size={28} />}
        title="Aucune enveloppe configurée"
        description="Créez un budget pour suivre vos dépenses par catégorie."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-12 bg-white/5 rounded-lg p-8 md:p-12 border border-separator">
      {rows.map((row, i) => (
        <motion.button
          key={row.categoryId}
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onOpenCategory(row.categoryId)}
          className="w-full text-left space-y-4 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white group-hover:text-gold transition-colors">
              {row.label}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`text-caption font-semibold ${
                  row.status === 'risk'
                    ? 'text-negative'
                    : row.status === 'watch'
                      ? 'text-gold'
                      : 'text-label/40'
                }`}
              >
                {row.status}
              </span>
              <p
                className={`text-caption font-bold tabular-nums ${row.spent < 0 ? 'text-positive' : 'text-white'}`}
              >
                {row.spent.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}
                <span className="text-label/20 font-light mx-1">/</span>
                <span className="text-label/40">
                  {row.limit.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                    maximumFractionDigits: 0,
                  })}
                </span>
              </p>
            </div>
          </div>

          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
            {/* Reference Line (Theoretical Progress) */}
            {row.theoreticalPct !== undefined && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
                style={{ left: `${Math.min(100, row.theoreticalPct)}%` }}
                title="Rythme théorique"
              />
            )}

            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min(100, row.consumedPct)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: 'circOut' }}
              className={`h-full ${
                row.status === 'risk'
                  ? 'bg-negative shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                  : row.status === 'watch'
                    ? 'bg-gold shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                    : 'bg-label/40'
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-caption font-semibold">
            <p className="text-label/20">{Math.round(row.consumedPct)}% Consommé</p>
            <p
              className={
                row.spent < 0
                  ? 'text-positive'
                  : row.remaining < 0
                    ? 'text-negative'
                    : 'text-label/40'
              }
            >
              {row.spent < 0 ? 'Solde positif ' : row.remaining < 0 ? 'Dépassé de ' : 'Reste '}
              {Math.abs(row.spent < 0 ? row.spent : row.remaining).toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </motion.button>
      ))}
    </div>
  );
};
