import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { formatLibelle } from '../../utils/categoryUtils';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { CategoryIcon } from '../CategoryIcon';
import type { Transaction } from '../../types/banking.types';
import { Check, ArrowUp, ArrowDown, ArrowUpDown, Repeat2 } from 'lucide-react';
import { formatCurrency as cachedFormatCurrency } from '../../lib/formatters';

type SortKey = 'date' | 'montant' | 'libelle' | 'categorie' | 'compte';
type SortDir = 'asc' | 'desc';

interface TransactionCardProps {
  tx: Transaction;
  onOpenDetail: (id: string) => void;
  onTogglePointe: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isRecurrent?: boolean;
}

const SWIPE_THRESHOLD = 140;
const MS_IN_A_DAY = 86400000;
const OBSERVER_ROOT_MARGIN = '200px';

const TransactionCard = React.memo<TransactionCardProps & { isFirst: boolean; isLast: boolean }>(
  ({
    tx,
    onOpenDetail,
    onTogglePointe,
    selectionMode,
    selected,
    onToggleSelect,
    isFirst,
    isLast,
    isRecurrent = false,
  }) => {
    const { formatMessage: t } = useIntl();
    const montant = tx.montant ?? 0;
    const isPositive = montant >= 0;
    const catMeta = getCategoryMeta(tx.categorie || '');
    const cleanLibelle = formatLibelle(tx.libelle || '');

    const x = useMotionValue(0);
    const dragOpacity = useTransform(x, [-100, 0, 100], [0.8, 1, 0.8]);
    const backgroundOpacity = useTransform(x, [-100, -40, 0, 40, 100], [1, 1, 0, 1, 1]);

    const handleDragEnd = async (_: unknown, info: { offset: { x: number } }) => {
      if (Math.abs(info.offset.x) > SWIPE_THRESHOLD) {
        onTogglePointe(tx.id, !tx.pointe);
      }
      x.set(0);
    };

    const formatCurrency = (amount: number) => {
      return cachedFormatCurrency(amount, 'EUR', 'fr-FR', { signDisplay: 'always' });
    };

    return (
      <div
        className={`relative group select-none border-b border-separator last:border-none
      ${isFirst ? 'rounded-t-xl' : ''} 
      ${isLast ? 'rounded-b-lg' : ''}`}
      >
        {/* Background Action Indicator */}
        <motion.div
          style={{ opacity: backgroundOpacity }}
          className="absolute inset-0 flex items-center justify-between px-10 bg-gold/10 pointer-events-none rounded-lg overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center border border-gold/30">
              <Check className="text-gold" size={12} aria-hidden="true" />
            </div>
            <span className="text-caption font-semibold text-gold">
              {t({ id: 'txList.swipe.validate' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption font-semibold text-gold">
              {t({ id: 'txList.swipe.validate' })}
            </span>
            <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center border border-gold/30">
              <Check className="text-gold" size={12} aria-hidden="true" />
            </div>
          </div>
        </motion.div>

        <motion.div
          drag={selectionMode ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={handleDragEnd}
          style={selectionMode ? undefined : { x, opacity: dragOpacity }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={() => (selectionMode ? onToggleSelect(tx.id) : onOpenDetail(tx.id))}
          className={`density-row relative flex items-center gap-6 px-10 py-6 transition-all duration-500 cursor-pointer
          ${selected ? 'bg-gold/10 ring-1 ring-inset ring-gold/40' : ''}
          ${!tx.pointe ? 'opacity-40 grayscale-[0.8]' : 'opacity-100 hover:bg-white/[0.04]'}`}
        >
          {/* Selection checkbox */}
          {selectionMode && (
            <input
              type="checkbox"
              checked={selected}
              readOnly
              tabIndex={-1}
              aria-label={t({ id: 'tx.bulk.selectRow' })}
              className="w-5 h-5 rounded-lg accent-gold cursor-pointer shrink-0 pointer-events-none"
            />
          )}

          {/* Category Icon */}
          <div
            className={`density-row-icon w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-all duration-500
            ${tx.pointe ? 'bg-gold-subtle border-gold/20' : 'bg-zinc-900/50 border-separator grayscale'}`}
          >
            <CategoryIcon
              icon={catMeta.icon}
              size={20}
              color={tx.pointe ? catMeta.color : '#52525B'}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 mx-2">
            <h3
              className={`text-subhead font-bold tracking-tight transition-colors ${tx.pointe ? 'text-white' : 'text-label-tertiary'}`}
            >
              {cleanLibelle || tx.libelle}
            </h3>
            <p
              className="text-caption font-bold text-label-tertiary mt-1 opacity-80 truncate"
              title={tx.commentaire || undefined}
            >
              {tx.categorie || '—'} • {tx.compte}
              {tx.commentaire ? ` • ${tx.commentaire}` : ''}
            </p>
          </div>

          {/* Amount */}
          <div className="text-right shrink-0 ml-4 flex items-center gap-2">
            {isRecurrent && (
              <Repeat2 size={13} className="text-positive shrink-0" aria-label="Récurrence liée" />
            )}
            <p
              className={`font-serif text-xl font-bold [font-variant-numeric:tabular-nums] transition-colors
            ${!tx.pointe ? 'text-label-tertiary' : isPositive ? 'text-gold' : 'text-negative'}`}
            >
              {formatCurrency(tx.montant ?? 0)}
            </p>
          </div>
        </motion.div>
      </div>
    );
  },
);
TransactionCard.displayName = 'TransactionCard';

interface TransactionGroupedListProps {
  transactions: Transaction[];
  onOpenDetail: (id: string) => void;
  onTogglePointe: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  linkedTxIds?: Set<string>;
}

const INITIAL_DAYS_COUNT = 3;
const BATCH_DAYS_COUNT = 3;

export const TransactionGroupedList: React.FC<TransactionGroupedListProps> = ({
  transactions,
  onOpenDetail,
  onTogglePointe,
  onDelete,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  linkedTxIds,
}) => {
  const { formatMessage: t } = useIntl();
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [visibleDaysCount, setVisibleDaysCount] = useState(INITIAL_DAYS_COUNT);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' || key === 'montant' ? 'desc' : 'asc');
    }
  };

  const groups = useMemo(() => {
    // 1. Sort base transactions first
    const sorted = [...transactions].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = (a.date || '').localeCompare(b.date || '');
      else if (sortKey === 'montant') cmp = (a.montant || 0) - (b.montant || 0);
      else if (sortKey === 'libelle') cmp = (a.libelle || '').localeCompare(b.libelle || '', 'fr');
      else if (sortKey === 'categorie')
        cmp = (a.categorie || '').localeCompare(b.categorie || '', 'fr');
      else if (sortKey === 'compte') cmp = (a.compte || '').localeCompare(b.compte || '', 'fr');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const grouped: Record<
      string,
      { date: string; total: number; allPointed: boolean; txs: Transaction[] }
    > = {};

    sorted.forEach((tx) => {
      // Sentinel key — translated to a label at render time via formatDateLabel.
      const date = tx.date || '__unknown__';
      if (!grouped[date]) {
        grouped[date] = { date, total: 0, allPointed: true, txs: [] };
      }
      grouped[date].txs.push(tx);
      grouped[date].total += tx.montant || 0;
      if (!tx.pointe) grouped[date].allPointed = false;
    });

    return Object.values(grouped).sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return sortKey === 'date' && sortDir === 'asc' ? -cmp : cmp;
    });
  }, [transactions, sortKey, sortDir]);

  const visibleGroups = useMemo(() => {
    return groups.slice(0, visibleDaysCount);
  }, [groups, visibleDaysCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleDaysCount((prev) => prev + BATCH_DAYS_COUNT);
        }
      },
      { rootMargin: OBSERVER_ROOT_MARGIN },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [groups.length, visibleDaysCount]);

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === '__unknown__') return t({ id: 'txList.date.unknown' });

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - MS_IN_A_DAY).toISOString().split('T')[0];

    if (dateStr === today) return t({ id: 'txList.date.today' });
    if (dateStr === yesterday) return t({ id: 'txList.date.yesterday' });

    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return cachedFormatCurrency(amount, 'EUR', 'fr-FR', { signDisplay: 'always' });
  };

  if (transactions.length === 0) {
    return (
      <div className="py-24 text-center text-label-tertiary text-xs opacity-40">
        {t({ id: 'txList.empty' })}
      </div>
    );
  }

  const SORT_BTN_CLS = (
    key: SortKey,
  ) => `flex items-center gap-2 text-caption font-bold transition-colors
    ${sortKey === key ? 'text-gold' : 'text-label-tertiary hover:text-label-secondary'}`;

  return (
    <div className="space-y-12">
      {/* Table-like headers for sorting control */}
      <div className="hidden md:flex items-center gap-4 px-6 py-2 border-b border-separator bg-surface rounded-xl mb-4">
        <div className="w-10 shrink-0" /> {/* Icon space aligned with new smaller icons */}
        <div className="flex-1 flex items-center gap-8">
          <button onClick={() => handleSort('libelle')} className={SORT_BTN_CLS('libelle')}>
            {t({ id: 'txList.sort.label' })}
            {sortKey === 'libelle' ? (
              sortDir === 'asc' ? (
                <ArrowUp size={10} aria-hidden="true" />
              ) : (
                <ArrowDown size={10} aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown size={10} className="opacity-30" aria-hidden="true" />
            )}
          </button>
          <button onClick={() => handleSort('compte')} className={SORT_BTN_CLS('compte')}>
            {t({ id: 'txList.sort.account' })}
            {sortKey === 'compte' ? (
              sortDir === 'asc' ? (
                <ArrowUp size={10} aria-hidden="true" />
              ) : (
                <ArrowDown size={10} aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown size={10} className="opacity-30" aria-hidden="true" />
            )}
          </button>
        </div>
        <button
          onClick={() => handleSort('montant')}
          className={`${SORT_BTN_CLS('montant')} ml-auto w-32 justify-end`}
        >
          {t({ id: 'txList.sort.amount' })}
          {sortKey === 'montant' ? (
            sortDir === 'asc' ? (
              <ArrowUp size={10} aria-hidden="true" />
            ) : (
              <ArrowDown size={10} aria-hidden="true" />
            )
          ) : (
            <ArrowUpDown size={10} className="opacity-30" aria-hidden="true" />
          )}
        </button>
      </div>

      {visibleGroups.map((group) => (
        <div key={group.date} className="space-y-4">
          {/* Sticky Header */}
          <div
            className={`density-group-header sticky z-30 flex items-center justify-between py-4 px-4 bg-bg backdrop-blur-xl border-b border-separator mx-[-12px] px-[12px] top-[calc(env(safe-area-inset-top,0px)+171px)] md:top-[calc(env(safe-area-inset-top,0px)+195px)]`}
          >
            <h3
              className={`text-caption font-semibold text-label-tertiary flex items-center gap-2 transition-opacity duration-500 ${group.allPointed ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="w-1 h-1 rounded-full bg-gold/40" />
              {formatDateLabel(group.date)}
            </h3>
            <span
              className={`font-serif text-caption font-bold [font-variant-numeric:tabular-nums] transition-opacity duration-500 ${group.allPointed ? 'opacity-40' : 'opacity-100'} ${group.total >= 0 ? 'text-gold/80' : 'text-label-tertiary'}`}
            >
              {formatCurrency(group.total)}
            </span>
          </div>

          {/* Daily Container (Glass Panel) — content-visibility borne le coût de
              rendu des groupes hors écran sans les démonter (le header sticky reste
              hors du sous-arbre contenu). `auto 400px` : estimation avant premier
              rendu, puis taille mémorisée. */}
          <div
            className="bg-surface border-none rounded-lg overflow-hidden divide-y divide-separator"
            style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}
          >
            {group.txs.map((tx, idx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                onOpenDetail={onOpenDetail}
                onTogglePointe={onTogglePointe}
                onDelete={onDelete}
                selectionMode={selectionMode}
                selected={selectedIds?.has(tx.id) ?? false}
                onToggleSelect={onToggleSelect ?? (() => {})}
                isFirst={idx === 0}
                isLast={idx === group.txs.length - 1}
                isRecurrent={linkedTxIds?.has(tx.id) ?? false}
              />
            ))}
          </div>
        </div>
      ))}

      {groups.length > visibleDaysCount && (
        <div
          ref={sentinelRef}
          className="h-10 flex items-center justify-center text-label/30 text-xs py-4"
        >
          {t({ id: 'tx.list.loading' })}
        </div>
      )}
    </div>
  );
};
