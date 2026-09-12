import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import { motion } from 'framer-motion';
import { MoreHorizontal, CheckCircle2, Check } from 'lucide-react';
import { EmptyState } from '../../shared/EmptyState';
import { IconButton } from '../../../ui';

import { formatCurrency } from '../../../lib/formatters';
import { CategoryIcon } from '../../CategoryIcon';
import { getCategoryMeta } from '../../../constants/categoryMetadata';

interface Transaction {
  id: string;
  libelle: string;
  montant: number;
  date: string;
  categorie?: string;
  pointe?: boolean;
}

export const AurumRecentTransactions: React.FC<{
  transactions: Transaction[];
  onTransactionClick?: (id: string) => void;
  /** Optionnel : active la pastille de pointage rapide sur chaque ligne. */
  onTogglePointe?: (id: string, pointe: boolean) => void;
}> = ({ transactions, onTransactionClick, onTogglePointe }) => {
  const [visibleDaysCount, setVisibleDaysCount] = useState(2);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    transactions.forEach((tx) => {
      // tx.date est déjà normalisée en ISO (YYYY-MM-DD) — pas de round-trip
      // Date/UTC qui peut décaler le jour selon le fuseau.
      const d = tx.date ? String(tx.date).slice(0, 10) : 'undated';
      if (!g[d]) g[d] = [];
      g[d].push(tx);
    });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const visibleGroups = useMemo(() => {
    return grouped.slice(0, visibleDaysCount);
  }, [grouped, visibleDaysCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleDaysCount((prev) => prev + 2);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [grouped.length, visibleDaysCount]);

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<MoreHorizontal size={28} />}
        title="Aucun flux récent"
        description="Les transactions apparaîtront ici."
      />
    );
  }

  const MS_IN_A_DAY = 86400000;
  const formatDateLabel = (dateStr: string) => {
    if (dateStr === 'undated') return 'Date inconnue';
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - MS_IN_A_DAY).toISOString().split('T')[0];

    if (dateStr === today) return "Aujourd'hui";
    if (dateStr === yesterday) return 'Hier';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div className="space-y-6">
      {visibleGroups.map(([date, txs]) => (
        <div key={date} className="space-y-4">
          <h4 className="text-caption font-semibold text-label-tertiary px-2">
            {formatDateLabel(date)}
          </h4>
          <div className="space-y-4">
            {txs.map((tx, i) => {
              const meta = getCategoryMeta(tx.categorie);
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onTransactionClick?.(tx.id)}
                  className="flex items-center justify-between p-4 rounded-xl bg-surface border border-separator hover:bg-white/[0.04] hover:border-separator transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${tx.pointe ? 'bg-gold/10 text-gold' : 'bg-white/5 text-white/40 group-hover:text-white'}`}
                    >
                      <CategoryIcon
                        icon={meta.icon}
                        size={20}
                        color={tx.pointe ? CHART_COLORS.gold : meta.color}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-footnote font-semibold text-white tracking-tight line-clamp-1 max-w-[140px]">
                          {tx.libelle}
                        </p>
                        {tx.pointe && <CheckCircle2 size={12} className="text-gold opacity-50" />}
                      </div>
                      <p className="text-caption font-bold text-label-tertiary mt-1">
                        {tx.categorie || 'Autre'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-footnote font-bold tabular-nums ${tx.montant < 0 ? 'text-white' : 'text-positive'}`}
                    >
                      {tx.montant > 0 ? '+' : ''}
                      {formatCurrency(tx.montant)}
                    </p>
                    {onTogglePointe && (
                      <IconButton
                        label={tx.pointe ? 'Dépointée' : 'Pointer'}
                        size="sm"
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePointe(tx.id, !tx.pointe);
                        }}
                        className={`!rounded-full border shrink-0 ${
                          tx.pointe
                            ? 'border-gold/40 !bg-gold/20 !text-gold'
                            : 'border-separator hover:!text-label'
                        }`}
                      >
                        <Check size={16} />
                      </IconButton>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Sentinel for Infinite Scroll */}
      {visibleDaysCount < grouped.length && <div ref={sentinelRef} className="h-4 w-full" />}
    </div>
  );
};
