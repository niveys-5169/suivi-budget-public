import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Globe, BarChart2 } from 'lucide-react';
import { Holding } from '../hooks/usePortfolio';
import { fmt } from '../utils/format';
import { Skeleton } from './shared/Skeleton';

interface WealthPortfolioTableProps {
  holdings: Holding[];
  loading?: boolean;
  /** Ouvre le détail d'une position (ligne cliquable quand fourni). */
  onSelectHolding?: (holding: Holding) => void;
}

export const WealthPortfolioTable: React.FC<WealthPortfolioTableProps> = ({
  holdings,
  loading,
  onSelectHolding,
}) => {
  if (loading && holdings.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-separator p-8 space-y-4">
        <Skeleton className="h-12 rounded-lg" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="p-12 text-center bg-surface rounded-xl border-dashed border-separator">
        <p className="text-label/20 text-caption">Aucune position boursière identifiée</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl overflow-hidden border border-separator">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="px-8 py-6 text-caption font-semibold text-label/30">Actif / ISIN</th>
              <th className="px-8 py-6 text-caption font-semibold text-label/30">Propriétaire</th>
              <th className="px-8 py-6 text-caption font-semibold text-label/30 text-right">
                Quantité / PRU
              </th>
              <th className="px-8 py-6 text-caption font-semibold text-label/30 text-right">
                Valeur Actuelle
              </th>
              <th className="px-8 py-6 text-caption font-semibold text-label/30 text-right">
                Plus-value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {holdings.map((h, i) => {
              const isPositive = h.unrealizedGain >= 0;
              return (
                <motion.tr
                  key={h.docId}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                  onClick={onSelectHolding ? () => onSelectHolding(h) : undefined}
                  onKeyDown={
                    onSelectHolding
                      ? (e: React.KeyboardEvent) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectHolding(h);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onSelectHolding ? 0 : undefined}
                  role={onSelectHolding ? 'button' : undefined}
                  className={`hover:bg-surface transition-colors group ${
                    onSelectHolding ? 'cursor-pointer focus:outline-none focus:bg-white/[0.04]' : ''
                  }`}
                >
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-white group-hover:text-gold transition-colors">
                        {h.name}
                      </span>
                      <div className="flex items-center gap-2 text-caption font-medium text-label/30">
                        <span>{h.ticker || h.isin}</span>
                        <span className="w-1 h-1 rounded-full bg-current opacity-20" />
                        <span className="flex items-center gap-1">
                          <Globe size={10} className="opacity-50" /> {h.account}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-caption font-semibold text-label/40 px-4 py-1 rounded-full border border-separator bg-white/5">
                      {h.owner}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white tabular-nums">
                        {h.quantity.toLocaleString('fr-FR')}
                      </span>
                      <span className="text-caption font-medium text-label/30 tabular-nums">
                        PRU: {fmt(h.avgPrice)}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white tabular-nums">
                        {fmt(h.currentValue)}
                      </span>
                      <span className="text-caption font-medium text-label/30 tabular-nums">
                        {fmt(h.lastPrice)} / part
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <div
                        className={`flex items-center gap-2 text-sm font-serif font-bold tabular-nums ${isPositive ? 'text-positive' : 'text-negative'}`}
                      >
                        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {isPositive ? '+' : ''}
                        {fmt(h.unrealizedGain)}
                      </div>
                      <span
                        className={`text-caption font-semibold tabular-nums opacity-60 ${isPositive ? 'text-positive' : 'text-negative'}`}
                      >
                        {isPositive ? '+' : ''}
                        {h.unrealizedGainPct.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-8 py-4 bg-surface border-t border-separator flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-caption font-semibold text-label/20">
            <BarChart2 size={12} />
            <span>Positions Live via SuiviPortefeuille</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-caption font-semibold text-label/20">
          <Clock size={12} />
          <span>Temps réel différé</span>
        </div>
      </div>
    </div>
  );
};
