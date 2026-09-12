import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { Modal } from '../shared/Modal';
import {
  Utensils,
  ShoppingBag,
  Car,
  Home,
  Film,
  Activity,
  TrendingUp,
  HelpCircle,
  Fuel,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Tag,
  ChevronRight,
  Save,
} from 'lucide-react';
import type { Transaction } from '../../types/banking.types';
import { formatCurrency } from '../../lib/formatters';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { EmptyState } from '../shared/EmptyState';
import { MoneyInput } from '../shared/MoneyInput';

const ICONS: Record<string, React.ElementType> = {
  utensils: Utensils,
  'shopping-bag': ShoppingBag,
  car: Car,
  home: Home,
  film: Film,
  activity: Activity,
  'trending-up': TrendingUp,
  'help-circle': HelpCircle,
  fuel: Fuel,
  'refresh-cw': RefreshCw,
  'shopping-cart': ShoppingCart,
};

type ReconcileFilter = 'all' | 'reconciled' | 'unreconciled';

interface TransactionListProps {
  transactions: Transaction[];
  reconcileFilter?: ReconcileFilter;
  onToggleReconciled?: (id: string, next: boolean) => Promise<void> | void;
  onSaveTransaction?: (payload: {
    id: string;
    libelle: string;
    montant: number;
    categorie: string;
    date: string;
    compte: string;
    pointe: boolean;
    commentaire?: string;
  }) => Promise<void> | void;
  onOpenDetail?: (id: string) => void;
}

// ─── Detail body (content-only, rendered inside Modal) ───────────────────────
const TransactionDetailBody: React.FC<{
  tx: Transaction;
  onClose: () => void;
  onToggleReconciled?: (id: string, next: boolean) => Promise<void> | void;
  onSaveTransaction?: TransactionListProps['onSaveTransaction'];
}> = ({ tx, onClose, onToggleReconciled, onSaveTransaction }) => {
  const { formatMessage: t } = useIntl();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<{
    libelle: string;
    montant: number | null;
    categorie: string;
    date: string;
    compte: string;
    pointe: boolean;
    commentaire: string;
  }>({
    libelle: tx.libelle || '',
    montant: tx.montant ?? 0,
    categorie: tx.categorie || tx.rawCategorie || '',
    date: (tx.date || '').slice(0, 10),
    compte: tx.compte || '',
    pointe: !!tx.pointe,
    commentaire: tx.commentaire || '',
  });

  const meta = getCategoryMeta(tx.categorie || tx.rawCategorie);
  const Icon = ICONS[meta.icon] ?? HelpCircle;
  const isOut = (form.montant ?? 0) < 0;

  const save = async () => {
    if (!onSaveTransaction) return;
    setIsSaving(true);
    try {
      await onSaveTransaction({
        id: tx.id,
        libelle: form.libelle.trim(),
        montant: form.montant ?? 0,
        categorie: form.categorie.trim(),
        date: form.date,
        compte: form.compte.trim(),
        pointe: form.pointe,
        commentaire: form.commentaire.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Category icon + name */}
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-card flex items-center justify-center border border-separator flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${meta.color}15, ${meta.color}05)` }}
        >
          <Icon size={24} style={{ color: meta.color }} />
        </div>
        <p className="text-caption font-semibold text-label/50">
          {tx.categorie || tx.rawCategorie}
        </p>
      </div>

      {/* Amount hero */}
      <div className="text-center py-6 bg-white/5 rounded-card border border-separator">
        <p
          className={`font-serif text-5xl md:text-6xl font-bold tracking-tighter tabular-nums
                       ${isOut ? 'text-white' : 'text-gold'}`}
        >
          {isOut ? '' : '+'}
          {formatCurrency(tx.montant ?? 0, 'EUR')}
        </p>
        <p className="text-caption font-semibold text-label/40 mt-4">
          {new Date(tx.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setIsEditing((v) => !v)}
          className="flex items-center justify-center gap-4 min-h-[44px] rounded-control bg-white/5 border border-separator text-caption font-semibold text-label/60 hover:bg-white/10 transition-all"
        >
          <Tag size={16} aria-hidden="true" />{' '}
          {isEditing
            ? t({ id: 'tx.row.action.toggleEdit.close' })
            : t({ id: 'tx.row.action.toggleEdit.open' })}
        </button>
        <button
          onClick={() => onToggleReconciled?.(tx.id, !form.pointe)}
          className="flex items-center justify-center gap-4 min-h-[44px] rounded-control bg-negative/5 border border-negative/20 text-caption font-semibold text-negative hover:bg-negative/10 transition-all"
        >
          <Trash2 size={16} aria-hidden="true" />
          {form.pointe
            ? t({ id: 'tx.row.action.unreconcile' })
            : t({ id: 'tx.row.action.reconcile' })}
        </button>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="space-y-4 rounded-card border border-separator bg-surface p-4">
          <input
            className="w-full rounded-control bg-black/20 border border-separator p-4 text-base text-white min-h-[44px]"
            value={form.libelle}
            onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
            aria-label={t({ id: 'tx.detail.field.label.aria' })}
            placeholder={t({ id: 'tx.detail.field.label.placeholder' })}
          />
          <div className="grid grid-cols-2 gap-2">
            <MoneyInput
              className="rounded-control bg-black/20 border border-separator p-4 text-base text-white min-h-[44px]"
              value={form.montant}
              onChange={(v) => setForm((f) => ({ ...f, montant: v }))}
              aria-label={t({ id: 'tx.detail.field.amount.placeholder' })}
              placeholder={t({ id: 'tx.detail.field.amount.placeholder' })}
            />
            <input
              className="rounded-control bg-black/20 border border-separator p-4 text-base text-white min-h-[44px]"
              value={form.categorie}
              onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
              aria-label={t({ id: 'tx.detail.field.category.placeholder' })}
              placeholder={t({ id: 'tx.detail.field.category.placeholder' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              className="rounded-control bg-black/20 border border-separator p-4 text-base text-white min-h-[44px]"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              aria-label={t({ id: 'tx.form.date' })}
            />
            <input
              className="rounded-control bg-black/20 border border-separator p-4 text-base text-white min-h-[44px]"
              value={form.compte}
              onChange={(e) => setForm((f) => ({ ...f, compte: e.target.value }))}
              aria-label={t({ id: 'tx.detail.field.account.placeholder' })}
              placeholder={t({ id: 'tx.detail.field.account.placeholder' })}
            />
          </div>
          <textarea
            className="w-full rounded-control bg-black/20 border border-separator p-4 text-base text-white"
            rows={2}
            value={form.commentaire}
            onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
            aria-label={t({ id: 'tx.detail.field.memo.placeholder' })}
            placeholder={t({ id: 'tx.detail.field.memo.placeholder' })}
          />
          <button
            disabled={isSaving}
            onClick={save}
            className="w-full rounded-control bg-gold text-bg min-h-[44px] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={14} aria-hidden="true" />
            {isSaving ? t({ id: 'state.saving' }) : t({ id: 'action.save' })}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────
// Memoized: the list renders dozens of rows and each row is pure given its
// transaction object + stable callbacks from the parent's useCallback.
const TransactionRow = React.memo<{
  t: Transaction;
  idx: number;
  onSelect: (t: Transaction) => void;
}>(({ t, idx, onSelect }) => {
  const { formatMessage } = useIntl();
  const prefersReducedMotion = useReducedMotion();
  const meta = getCategoryMeta(t.categorie || t.rawCategorie);
  const Icon = ICONS[meta.icon] ?? HelpCircle;
  const isOut = (t.montant ?? 0) < 0;

  return (
    <div className="relative group overflow-hidden rounded-lg">
      {/* Swipe-reveal background */}
      <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end px-6 bg-negative/10 rounded-lg -z-10">
        <Trash2 size={20} className="text-negative" />
      </div>

      <motion.button
        onClick={() => onSelect(t)}
        // Entry: simple fade on reduced-motion, subtle slide-up otherwise
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: prefersReducedMotion ? 0 : Math.min(idx * 0.03, 0.4) }}
        // Desktop hover shift — irrelevant on touch, harmless to keep
        whileHover={prefersReducedMotion ? undefined : { x: 4 }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        // touch-action: pan-y lets the browser handle vertical scrolling while
        // allowing our JS to capture horizontal swipes.  Without this, iOS/Android
        // may intercept the horizontal touch as their "back navigation" gesture.
        style={{ touchAction: 'pan-y' }}
        className="density-row w-full flex items-center justify-between p-4 md:p-4 rounded-xl md:rounded-lg bg-raised border border-separator hover:border-separator transition-all text-left group-hover:bg-raised"
      >
        <div className="flex items-center gap-4 md:gap-4">
          <div
            className="density-row-icon w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-lg flex items-center justify-center flex-shrink-0 border border-separator group-hover:scale-105 transition-transform"
            style={{ background: `linear-gradient(135deg, ${meta.color}12, ${meta.color}05)` }}
          >
            <Icon size={24} style={{ color: meta.color }} />
          </div>
          <div>
            <p className="text-white text-subhead font-bold tracking-tight group-hover:text-gold transition-colors">
              {t.libelle}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-caption md:text-caption font-semibold md:text-label/45">
                {t.categorie || t.rawCategorie}
              </span>
              {t.pointe ? (
                <div className="px-2 py-1 rounded-full bg-positive/10 border border-positive text-caption font-semibold text-positive tracking-tighter">
                  {formatMessage({ id: 'tx.row.badge.reconciled' })}
                </div>
              ) : (
                <div className="px-2 py-1 rounded-full bg-gold/10 border border-gold/20 text-caption font-semibold text-gold tracking-tighter">
                  {formatMessage({ id: 'tx.row.badge.unreconciled' })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-6 text-right">
          <div>
            <p
              className={`text-lg font-bold tracking-tight tabular-nums ${isOut ? 'text-white' : 'text-gold'}`}
            >
              {isOut ? '' : '+'}
              {formatCurrency(t.montant ?? 0, 'EUR')}
            </p>
            <p className="text-caption md:text-caption font-semibold text-label/35 md:mt-1">
              {new Date(t.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <ChevronRight
            size={18}
            className="text-label-tertiary group-hover:text-gold transition-colors"
          />
        </div>
      </motion.button>
    </div>
  );
});
TransactionRow.displayName = 'TransactionRow';

const INITIAL_GROUPS_COUNT = 3;
const BATCH_GROUPS_COUNT = 3;

// ─── List ─────────────────────────────────────────────────────────────────────
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  reconcileFilter = 'all',
  onToggleReconciled,
  onSaveTransaction,
  onOpenDetail,
}) => {
  const { formatMessage: t } = useIntl();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(INITIAL_GROUPS_COUNT);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const select = useCallback(
    (t: Transaction) => {
      if (onOpenDetail) {
        onOpenDetail(t.id);
      } else {
        setSelected(t);
      }
    },
    [onOpenDetail],
  );

  const deselect = useCallback(() => setSelected(null), []);

  const filteredTransactions = useMemo(() => {
    if (reconcileFilter === 'reconciled') return transactions.filter((t) => t.pointe);
    if (reconcileFilter === 'unreconciled') return transactions.filter((t) => !t.pointe);
    return transactions;
  }, [transactions, reconcileFilter]);

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((t) => {
      const date = new Date(t.date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.entries(groups);
  }, [filteredTransactions]);

  const visibleGroups = useMemo(() => {
    return grouped.slice(0, visibleGroupsCount);
  }, [grouped, visibleGroupsCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleGroupsCount((prev) => prev + BATCH_GROUPS_COUNT);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [grouped.length]);

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle size={28} aria-hidden="true" />}
        title={t({ id: 'tx.empty.title' })}
        description={t({ id: 'tx.empty.description' })}
      />
    );
  }

  return (
    <>
      <div className="space-y-8 md:space-y-12">
        {visibleGroups.map(([date, txs], gIdx) => (
          <div key={date} className="space-y-4">
            <div className="sticky top-0 z-10 py-4 md:py-4 bg-bg backdrop-blur-md -mx-4 px-4 md:px-6 border-b border-separator flex items-center justify-between">
              <h4 className="text-caption md:text-caption font-semibold text-label/55 md:">
                {date}
              </h4>
              <span className="text-caption md:text-caption font-semibold text-label/35 md:">
                {t({ id: 'tx.list.dayCount' }, { count: txs.length })}
              </span>
            </div>
            {/* content-visibility borne le coût de rendu des groupes hors écran
                sans les démonter (le header sticky reste hors du sous-arbre contenu).
                `auto 400px` : taille estimée avant premier rendu, puis taille mémorisée. */}
            <div
              className="space-y-4"
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}
            >
              {txs.map((t, idx) => (
                <TransactionRow key={t.id} t={t} idx={idx + gIdx * 10} onSelect={select} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {grouped.length > visibleGroupsCount && (
        <div
          ref={sentinelRef}
          className="h-10 flex items-center justify-center text-label/30 text-xs py-4"
        >
          {t({ id: 'tx.list.loading' })}
        </div>
      )}

      <Modal
        isOpen={!!selected && !onOpenDetail}
        onClose={deselect}
        title={selected?.libelle || 'Transaction'}
        size="md"
        variant="centered"
      >
        {selected && (
          <TransactionDetailBody
            tx={selected}
            onClose={deselect}
            onToggleReconciled={onToggleReconciled}
            onSaveTransaction={onSaveTransaction}
          />
        )}
      </Modal>
    </>
  );
};

export default TransactionList;
