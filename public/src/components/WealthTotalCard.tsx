import React from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '../lib/formatters';
import type { CatEvolution } from '../utils/wealthEvolution';

interface WealthTotalCardProps {
  total: number;
  per?: number;
  /** Variation sur 1 mois ; null tant qu'il n'y a pas d'historique. */
  delta: CatEvolution | null;
  updatedAt: string;
}

export const WealthTotalCard: React.FC<WealthTotalCardProps> = ({
  total,
  per = 0,
  delta,
  updatedAt,
}) => {
  const isPositive = (delta?.delta ?? 0) >= 0;

  return (
    <div className="bg-white/5 rounded-lg border border-separator p-8 md:p-12 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-label/5 blur-[120px] rounded-full -z-10" />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="text-caption font-semibold text-label/40 mb-6">Valeur Nette Totale</p>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl md:text-7xl lg:text-8xl font-semibold text-white tracking-tighter tabular-nums leading-[1.05]"
          >
            {total.toLocaleString('fr-FR', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            })}
          </motion.h2>

          {per > 0 && (
            <div className="mt-4 px-4 py-2 rounded-full bg-white/5 border border-separator inline-flex items-center gap-2 text-caption font-bold text-label-tertiary">
              <span>
                dont{' '}
                {per.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0,
                })}{' '}
                en PER
              </span>
              <span className="opacity-40">(Actif Différé)</span>
            </div>
          )}
        </div>

        <div className="flex flex-col md:items-end gap-4">
          {delta && (
            <div className="flex flex-col md:items-end gap-2">
              <span className="text-caption font-semibold text-label/30">Évolution 1 mois</span>
              <div
                className={`flex items-center gap-4 px-6 py-4 rounded-lg border ${
                  isPositive
                    ? 'bg-positive/10 border-positive/20 text-positive'
                    : 'bg-negative/10 border-negative/20 text-negative'
                }`}
              >
                <span className="text-sm font-semibold">
                  {isPositive ? '▲' : '▼'}
                  {delta.deltaPct !== null && ` ${Math.abs(delta.deltaPct).toFixed(1)}%`}
                </span>
                <span className="w-px h-4 bg-current/20" />
                <span className="text-sm font-bold tabular-nums">
                  {formatCurrency(delta.delta)}
                </span>
              </div>
            </div>
          )}
          <p className="text-caption font-semibold text-label/20">Mis à jour le {updatedAt}</p>
        </div>
      </div>
    </div>
  );
};
