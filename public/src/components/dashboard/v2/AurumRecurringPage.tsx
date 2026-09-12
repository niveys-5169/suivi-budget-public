import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Euro,
  Check,
  X,
  RefreshCw,
  Trash2,
  Pencil,
  SkipForward,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowDownLeft,
  Link2,
  Archive,
  ChevronDown,
} from 'lucide-react';
import { useTransactions } from '../../../hooks/useTransactions';
import { getDayOfMonth, getApprovalEntries } from '../../../utils/recurrenceEngine';
import {
  useRecurrences,
  sortRecurrenceViews,
  type RecurrenceView,
  type RecurrenceSortKey as SortKey,
} from '../../../hooks/useRecurrences';
import { MonthNavigator } from '../../shared/MonthNavigator';
import { Recurrence, Transaction } from '../../../types/banking.types';
import { RecurrenceEditModal } from './RecurrenceEditModal';
import { LinkRecurrenceModal } from '../../shared/LinkRecurrenceModal';

import { IconButton } from '../../../ui';
import { formatCurrency } from '../../../lib/formatters';
import { confirm } from '../../../lib/confirm';

const fmt = (n: number) => formatCurrency(n);

export const AurumRecurringPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { transactions } = useTransactions();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const {
    expenses,
    incomes,
    archived,
    totals,
    hasRecurrences,
    approve,
    unapprove,
    link,
    unlink,
    linkCandidates,
    skip,
    unskip,
    edit,
    remove,
    setActive,
  } = useRecurrences(monthKey);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);
  const [linkingRecurrence, setLinkingRecurrence] = useState<Recurrence | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showArchived, setShowArchived] = useState(false);

  const handleSortClick = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(transactions.map((t) => (t.categorie || '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [transactions]);

  const sortedExpenses = useMemo(
    () => sortRecurrenceViews(expenses, sortBy, sortDir),
    [expenses, sortBy, sortDir],
  );
  const sortedIncomes = useMemo(
    () => sortRecurrenceViews(incomes, sortBy, sortDir),
    [incomes, sortBy, sortDir],
  );

  // « En attente » regroupe ce qui appelle une action (apparié à confirmer,
  // en retard) et ce qui reste à venir. Les mises en pause s'y affichent en fin
  // de liste, marquées d'un badge.
  const toApprove = sortedExpenses.filter((r) => r.state === 'matched');
  const expected = sortedExpenses.filter((r) => r.state === 'expected' || r.state === 'overdue');
  const skipped = sortedExpenses.filter((r) => r.state === 'skipped');
  const paid = sortedExpenses.filter((r) => r.state === 'approved');
  const pending = [...toApprove, ...expected];
  const pendingAndSkipped = [...pending, ...skipped];

  const handleManualLink = async (tx: Transaction) => {
    if (!linkingRecurrence) return;
    const rec = linkingRecurrence;
    setLinkingRecurrence(null);
    await link(rec, tx).catch(() => {});
  };

  const handleDelete = async (id: string, label: string): Promise<boolean> => {
    if (!(await confirm({ message: `Supprimer la récurrence « ${label} » ?`, danger: true })))
      return false;
    await remove(id);
    return true;
  };

  return (
    <div className="min-h-screen bg-bg text-white font-sans overflow-x-hidden selection:bg-gold/30 pb-40">
      <div className="fixed top-[-10%] right-[-5%] w-[50%] h-[40%] bg-gold/4 blur-[120px] rounded-full -z-10" />

      {/* Header */}
      <nav className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-lg bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tighter text-white">Récurrences</h1>
        </div>
        <MonthNavigator month={currentMonth} onChange={setCurrentMonth} />
      </nav>

      <main className="px-6 space-y-10">
        {/* Sort control */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-caption font-semibold text-label-tertiary">Trier par</span>
          <div className="flex gap-1 p-1 bg-surface border border-separator rounded-control">
            {(
              [
                ['date', 'Date'],
                ['amount', 'Montant'],
                ['label', 'Libellé'],
              ] as const
            ).map(([key, labelText]) => (
              <button
                key={key}
                onClick={() => handleSortClick(key)}
                className={`px-4 py-2 rounded-control text-caption font-semibold transition-all flex items-center gap-1 ${
                  sortBy === key ? 'bg-gold/10 text-gold' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {labelText}
                {sortBy === key &&
                  (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
              </button>
            ))}
          </div>
        </div>

        {/* Total card */}
        <section className="rounded-xl p-8 bg-gradient-to-br from-white/[0.05] to-transparent border border-separator backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
              <Euro size={20} />
            </div>
            <p className="text-sm font-bold text-white">Payé ce mois ({monthKey})</p>
          </div>
          <p className="text-4xl font-serif font-bold text-gold tabular-nums">
            {fmt(totals.approvedThisMonth)}
          </p>
          <p className="text-caption font-semibold text-label-tertiary mt-2">
            {paid.length} payé{paid.length !== 1 ? 's' : ''} • {pending.length} en attente
          </p>

          <div className="mt-6 pt-6 border-t border-separator space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-caption font-semibold text-white/30">Reste à payer</p>
              <p className="text-lg font-serif font-bold text-white tabular-nums">
                {fmt(totals.remaining)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-caption font-semibold text-white/30">Total récurrences</p>
              <p className="text-lg font-serif font-bold text-white tabular-nums">
                {fmt(totals.commitment)}
              </p>
            </div>
          </div>
        </section>

        {/* En attente (à approuver + attendues + en pause) */}
        {pendingAndSkipped.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <RefreshCw size={12} className="text-label-tertiary" />
              <span className="text-caption font-semibold text-label-tertiary">
                En attente ({pending.length})
              </span>
            </div>
            <div className="space-y-4">
              {toApprove.map((r, i) => (
                <RecurrenceItem
                  key={r.id}
                  r={r}
                  index={i}
                  onApprove={() => approve(r)}
                  onLink={() => setLinkingRecurrence(r)}
                  onSkip={() => skip(r)}
                  onEdit={() => setEditingRecurrence(r)}
                />
              ))}
              {expected.map((r, i) => (
                <RecurrenceItem
                  key={r.id}
                  r={r}
                  index={toApprove.length + i}
                  onLink={() => setLinkingRecurrence(r)}
                  onSkip={() => skip(r)}
                  onEdit={() => setEditingRecurrence(r)}
                />
              ))}
              {skipped.map((r, i) => (
                <RecurrenceItem
                  key={r.id}
                  r={r}
                  index={toApprove.length + expected.length + i}
                  onUnskip={() => unskip(r)}
                  onEdit={() => setEditingRecurrence(r)}
                  isSkipped
                />
              ))}
            </div>
          </section>
        )}

        {/* Paid */}
        {paid.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Check size={12} className="text-positive" />
              <span className="text-caption font-semibold text-positive">
                Payé ce mois ({paid.length})
              </span>
            </div>
            <div className="space-y-4">
              {paid.map((r, i) => (
                <RecurrenceItem
                  key={r.id}
                  r={r}
                  index={i}
                  onUnapprove={() => unapprove(r)}
                  onLink={() => setLinkingRecurrence(r)}
                  onUnlink={(txId) => unlink(r.id, txId)}
                  onEdit={() => setEditingRecurrence(r)}
                  isPaid
                />
              ))}
            </div>
          </section>
        )}

        {/* Revenus récurrents — masqués jusqu'ici sur desktop par un filtre
            expectedAmount < 0, alors que le mobile les affichait. */}
        {sortedIncomes.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <ArrowDownLeft size={12} className="text-positive" />
              <span className="text-caption font-semibold text-positive">
                Revenus ({sortedIncomes.length})
              </span>
              <span className="ml-auto text-caption font-semibold text-label-tertiary tabular-nums">
                {fmt(totals.incomeReceived)} encaissés
              </span>
            </div>
            <div className="space-y-4">
              {sortedIncomes.map((r, i) => (
                <RecurrenceItem
                  key={r.id}
                  r={r}
                  index={i}
                  onApprove={r.state === 'matched' ? () => approve(r) : undefined}
                  onUnapprove={r.state === 'approved' ? () => unapprove(r) : undefined}
                  onSkip={
                    r.state === 'expected' || r.state === 'overdue' ? () => skip(r) : undefined
                  }
                  onUnskip={r.state === 'skipped' ? () => unskip(r) : undefined}
                  onLink={r.state !== 'skipped' ? () => setLinkingRecurrence(r) : undefined}
                  onUnlink={r.state === 'approved' ? (txId) => unlink(r.id, txId) : undefined}
                  onEdit={() => setEditingRecurrence(r)}
                  isPaid={r.state === 'approved'}
                  isSkipped={r.state === 'skipped'}
                />
              ))}
            </div>
          </section>
        )}

        {!hasRecurrences && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-label-tertiary">
              <RefreshCw size={32} />
            </div>
            <p className="text-sm font-bold text-label-tertiary">Aucune récurrence configurée</p>
            <p className="text-xs text-label-tertiary">
              Ajoutez-en une depuis une transaction existante.
            </p>
          </div>
        )}

        {/* Archivées (récurrences en pause) — sinon introuvables, donc ni
            éditables ni supprimables. Repliée par défaut. */}
        {archived.length > 0 && (
          <section className="space-y-4">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-2 px-1 w-full text-left"
            >
              <Archive size={12} className="text-label-tertiary" />
              <span className="text-caption font-semibold text-label-tertiary">
                Archivées ({archived.length})
              </span>
              <ChevronDown
                size={14}
                className={`ml-auto text-label-tertiary transition-transform ${showArchived ? 'rotate-180' : ''}`}
              />
            </button>
            {showArchived && (
              <div className="space-y-4">
                {archived.map((r) => (
                  <ArchivedRow
                    key={r.id}
                    r={r}
                    onReactivate={() => setActive(r.id, true)}
                    onEdit={() => setEditingRecurrence(r)}
                    onDelete={() => handleDelete(r.id, r.label)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <RecurrenceEditModal
        recurrence={editingRecurrence}
        categories={categoryOptions}
        onClose={() => setEditingRecurrence(null)}
        onSave={edit}
        onDelete={async () => {
          if (!editingRecurrence) return;
          const { id, label } = editingRecurrence;
          if (await handleDelete(id, label)) setEditingRecurrence(null);
        }}
      />

      <LinkRecurrenceModal
        recurrence={linkingRecurrence}
        candidates={linkingRecurrence ? linkCandidates(linkingRecurrence, 50) : []}
        onClose={() => setLinkingRecurrence(null)}
        onLink={handleManualLink}
      />
    </div>
  );
};

const RecurrenceItem: React.FC<{
  r: RecurrenceView;
  index: number;
  onApprove?: () => void;
  onUnapprove?: () => void;
  onSkip?: () => void;
  onUnskip?: () => void;
  onLink?: () => void;
  onUnlink?: (txId: string) => void;
  onEdit: () => void;
  isPaid?: boolean;
  isSkipped?: boolean;
}> = ({
  r,
  index,
  onApprove,
  onUnapprove,
  onSkip,
  onUnskip,
  onLink,
  onUnlink,
  onEdit,
  isPaid,
  isSkipped,
}) => {
  const cadence = `Le ${getDayOfMonth(r)} du mois`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative flex flex-col p-4 rounded-xl border transition-all overflow-hidden ${
        isSkipped
          ? 'bg-white/[0.01] border-separator opacity-60'
          : 'bg-surface border-separator hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate" title={r.label}>
            {r.label}
          </p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-caption font-semibold text-gold">{r.category}</span>
            <span className="text-caption text-label-tertiary">{cadence}</span>
            {isSkipped && (
              <span className="text-caption font-semibold text-white/30 px-2 py-1 rounded-full bg-white/5">
                En pause
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 ml-4 flex-shrink-0">
          <span
            className={`text-base font-serif font-bold tabular-nums ${isPaid ? 'text-positive' : 'text-label'}`}
          >
            {fmt(r.displayAmount)}
          </span>

          <div className="flex items-center gap-2">
            {onLink && (
              <button
                onClick={onLink}
                className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold hover:bg-gold/20 transition-all"
                title={isPaid ? 'Lier une autre transaction' : 'Lier à une transaction'}
              >
                <Link2 size={14} />
              </button>
            )}
            {onApprove && (
              <button
                onClick={onApprove}
                className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold hover:bg-gold/20 transition-all"
                title="Approuver le paiement"
              >
                <Check size={14} />
              </button>
            )}
            {onUnapprove && (
              <button
                onClick={onUnapprove}
                className="w-9 h-9 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-white transition-all"
                title="Annuler l'approbation"
              >
                <X size={14} />
              </button>
            )}
            {onSkip && (
              <button
                onClick={onSkip}
                className="w-9 h-9 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-white transition-all"
                title="Ignorer cette récurrence pour la période"
              >
                <SkipForward size={14} />
              </button>
            )}
            {onUnskip && (
              <button
                onClick={onUnskip}
                className="w-9 h-9 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-white transition-all"
                title="Rétablir la récurrence pour la période"
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onClick={onEdit}
              className="w-9 h-9 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-label-tertiary hover:text-white transition-all"
              title="Modifier ou supprimer la récurrence"
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      </div>

      {r.match && !isPaid && !isSkipped && (
        <div className="mt-4 p-4 rounded-xl bg-gold/5 border border-gold/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={12} className="text-gold animate-spin-slow" />
            <p className="text-caption font-bold text-gold/80">
              Transaction trouvée le {(r.match.date.split('T')[0] ?? '').split('-')[2]}
            </p>
          </div>
          <p className="text-caption font-serif font-bold text-gold">{fmt(r.match.montant ?? 0)}</p>
        </div>
      )}

      {isPaid &&
        onUnlink &&
        (() => {
          const approval = r.approvedMonths?.[r.periodKey];
          const entries = approval ? getApprovalEntries(approval) : [];
          if (entries.length <= 1) return null;
          return (
            <div className="mt-4 pt-4 border-t border-separator space-y-2">
              {entries.map((entry) => (
                <div key={entry.txId} className="flex items-center gap-2 pl-2">
                  <span className="flex-1 text-caption text-label-tertiary">
                    {(entry.date.split('T')[0] ?? '').split('-').reverse().join('/')}
                  </span>
                  <span className="text-caption font-semibold text-label tabular-nums">
                    {fmt(Math.abs(entry.amount))}
                  </span>
                  <button
                    onClick={() => onUnlink(entry.txId)}
                    className="p-2 rounded-lg text-label-tertiary hover:bg-negative/10 hover:text-negative transition-colors"
                    title="Délier cette transaction"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
    </motion.div>
  );
};

/**
 * Ligne minimale pour une récurrence en pause. Boutons toujours visibles (pas de
 * survol) : réactiver, modifier, supprimer.
 */
const ArchivedRow: React.FC<{
  r: Recurrence;
  onReactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ r, onReactivate, onEdit, onDelete }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-separator opacity-70">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-white truncate" title={r.label}>
        {r.label}
      </p>
      <div className="flex items-center gap-4 mt-1">
        <span className="text-caption font-semibold text-gold">{r.category}</span>
        <span className="text-caption font-semibold text-white/30 px-2 py-1 rounded-full bg-white/5">
          En pause
        </span>
      </div>
    </div>
    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
      <span className="text-base font-serif font-bold tabular-nums text-label">
        {fmt(r.expectedAmount)}
      </span>
      <div className="flex items-center gap-2">
        <IconButton
          size="sm"
          label="Réactiver la récurrence"
          onClick={onReactivate}
          title="Réactiver la récurrence"
        >
          <RotateCcw size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label="Modifier la récurrence"
          onClick={onEdit}
          title="Modifier la récurrence"
        >
          <Pencil size={14} />
        </IconButton>
        <IconButton
          size="sm"
          label="Supprimer la récurrence"
          onClick={onDelete}
          title="Supprimer la récurrence"
          className="hover:text-negative"
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  </div>
);
