import React, { useMemo, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckSquare,
  X,
  Trash2,
  Tag,
  Type,
  Calendar,
  CheckCheck,
} from 'lucide-react';
import { useTransactions } from '../../hooks/useTransactions';
import type { TransactionFilters } from '../../hooks/useTransactions';
import type { Transaction } from '../../types/banking.types';
import { MScreenHeader } from '../components/MScreenHeader';
import { Button, Chip, IconButton, Stack, Text } from '../../ui';
import { MSearchBar } from '../components/MSearchBar';
import { MTransactionRow } from '../components/MTransactionRow';
import { MDateGroupHeader } from '../components/MDateGroupHeader';
import { MTransactionFilterModal } from '../components/MTransactionFilterModal';
import { TransactionFormModal } from '../../components/TransactionFormModal';
import { BulkActionDialog } from '../../components/transactions/BulkActionDialog';
import type { BulkDialogMode } from '../../components/transactions/BulkActionDialog';
import { PullToRefreshWrapper } from '../../components/PullToRefreshWrapper';
import { useFormOptions } from '../../hooks/useFormOptions';
import { useSyncTransactions } from '../../hooks/useSyncTransactions';
import { useRecurrences } from '../../hooks/useRecurrences';
import { useTransactionSelection } from '../../hooks/useTransactionSelection';
import { toast } from '../../lib/toast';
import { FormattedNumber } from 'react-intl';
import { getDayOfMonth } from '../../utils/recurrenceEngine';

export const TransactionsScreen: React.FC = () => {
  const {
    filteredTransactions,
    filters,
    updateFilters,
    resetFilters,
    saveTransaction,
    deleteTransaction,
    togglePointe,
    pointAll,
    unpointAll,
    bulkUpdate,
    bulkDelete,
    bulkSetPointe,
    hasMore,
    loadMore,
    loadingMore,
  } = useTransactions();

  const selection = useTransactionSelection();
  const { selectionMode, selectedIds } = selection;
  const selectedCount = selectedIds.size;
  const [bulkDialog, setBulkDialog] = useState<BulkDialogMode | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { categories, accounts } = useFormOptions();
  const { sync, isSyncing } = useSyncTransactions();
  const {
    mappings: { linkedTxToRecurrence, candidateTxToRecurrence },
    ignoredTxIds,
    ignoreTxMatch,
    link,
  } = useRecurrences();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Group transactions by date
  const groups = useMemo(() => {
    const grouped: Record<string, { transactions: Transaction[]; total: number }> = {};

    filteredTransactions.forEach((tx) => {
      const date = tx.date || new Date().toISOString().slice(0, 10);
      if (!grouped[date]) {
        grouped[date] = { transactions: [], total: 0 };
      }
      grouped[date].transactions.push(tx);
      grouped[date].total += tx.montant || 0;
    });

    return Object.entries(grouped).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  }, [filteredTransactions]);

  const handleEdit = (id: string) => {
    setEditingTxId(id);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingTxId(null);
    setIsModalOpen(true);
  };

  const handleBulkPointe = async (pointe: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkSetPointe(ids, pointe);
      toast.success(`${ids.length} transaction(s) ${pointe ? 'pointée(s)' : 'dépointée(s)'}`);
      selection.exitSelection();
    } catch {
      /* erreur gérée dans le contexte */
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkConfirm = async (mode: BulkDialogMode, value?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (mode === 'delete') {
      await bulkDelete(ids);
      toast.success(`${ids.length} transaction(s) supprimée(s)`);
    } else {
      const patch =
        mode === 'rename'
          ? { libelle: value }
          : mode === 'categorize'
            ? { categorie: value }
            : { moisAffectation: value };
      await bulkUpdate(ids, patch);
      toast.success(`${ids.length} transaction(s) mise(s) à jour`);
    }
    selection.exitSelection();
  };

  const editingTransaction = useMemo(
    () => (editingTxId ? filteredTransactions.find((t) => t.id === editingTxId) : null),
    [editingTxId, filteredTransactions],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MScreenHeader
        title="Flux"
        rightAction={
          <Stack direction="row" gap="sm" align="center">
            {!selectionMode && (
              <IconButton
                label="Synchroniser"
                variant="plain"
                size="sm"
                onClick={sync}
                disabled={isSyncing}
              >
                <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
              </IconButton>
            )}
            <Chip selected={selectionMode} onClick={selection.toggleSelectionMode}>
              <CheckSquare size={15} aria-hidden="true" />
              {selectionMode ? 'Annuler' : 'Sélectionner'}
            </Chip>
            {!selectionMode && (
              <IconButton label="Ajouter une transaction" size="sm" onClick={handleAdd}>
                <Plus size={20} />
              </IconButton>
            )}
          </Stack>
        }
      />

      <MSearchBar
        value={filters.search || ''}
        onChange={(val) => updateFilters({ search: val } satisfies Partial<TransactionFilters>)}
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFilterCount={
          Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length
        }
      />

      {/* Barre d'actions groupées */}
      {selectionMode && selectedCount > 0 && (
        <div className="shrink-0 px-4 py-2 bg-gold/5 border-b border-gold/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Text variant="footnote" tone="accent">
              {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
            </Text>
            <Button
              variant="plain"
              size="sm"
              onClick={() => {
                const allIds = filteredTransactions.map((tx) => tx.id);
                if (selectedCount === filteredTransactions.length) {
                  selection.clear();
                } else {
                  selection.selectAll(allIds);
                }
              }}
            >
              {selectedCount === filteredTransactions.length
                ? 'Tout désélectionner'
                : 'Tout sélectionner'}
            </Button>
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <Chip disabled={bulkBusy} onClick={() => setBulkDialog('rename')}>
              <Type size={14} aria-hidden="true" />
              Renommer
            </Chip>
            <Chip disabled={bulkBusy} onClick={() => setBulkDialog('categorize')}>
              <Tag size={14} aria-hidden="true" />
              Catégorie
            </Chip>
            <Chip disabled={bulkBusy} onClick={() => setBulkDialog('month')}>
              <Calendar size={14} aria-hidden="true" />
              Mois
            </Chip>
            <Chip disabled={bulkBusy} onClick={() => handleBulkPointe(true)}>
              <CheckCheck size={14} aria-hidden="true" />
              Pointer
            </Chip>
            <Chip disabled={bulkBusy} onClick={() => handleBulkPointe(false)}>
              <X size={14} aria-hidden="true" />
              Dépointer
            </Chip>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkBusy}
              onClick={() => setBulkDialog('delete')}
              className="shrink-0"
            >
              <Trash2 size={14} aria-hidden="true" />
              Supprimer
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-4">
        <PullToRefreshWrapper onRefresh={sync} disabled={isSyncing}>
          {groups.map(([date, group]) => (
            <div key={date}>
              <MDateGroupHeader date={date} total={group.total} />
              <div className="divide-y divide-separator">
                {group.transactions.map((tx) => (
                  <div key={tx.id}>
                    <MTransactionRow
                      transaction={tx}
                      onPress={handleEdit}
                      onTogglePointe={togglePointe}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(tx.id)}
                      onToggleSelect={selection.toggleSelect}
                      isRecurrent={!!linkedTxToRecurrence[tx.id]}
                    />
                    {candidateTxToRecurrence[tx.id] && !ignoredTxIds.includes(tx.id) && (
                      <div className="mx-4 mb-2 p-4 rounded-lg bg-gold/5 border border-gold/20">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-sm mt-1">🔗</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gold/80 leading-relaxed">
                              Correspond à{' '}
                              <strong className="text-white">
                                {candidateTxToRecurrence[tx.id]!.label}
                              </strong>
                            </p>
                            <p className="text-caption text-label-tertiary mt-1">
                              {candidateTxToRecurrence[tx.id]!.category} ·{' '}
                              <FormattedNumber
                                value={Math.abs(candidateTxToRecurrence[tx.id]!.expectedAmount)}
                                style="currency"
                                currency="EUR"
                              />{' '}
                              · prévue le {getDayOfMonth(candidateTxToRecurrence[tx.id]!)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => link(candidateTxToRecurrence[tx.id]!, tx)}
                            className="flex-1 py-2 rounded-lg bg-gold text-bg text-xs font-semibold active:opacity-80 transition-opacity"
                          >
                            Lier & Pointer
                          </button>
                          <button
                            onClick={() => ignoreTxMatch(tx.id)}
                            className="px-4 py-2 rounded-lg bg-white/5 border border-separator text-white/50 text-xs font-bold active:opacity-80 transition-opacity"
                          >
                            Ignorer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
              <p className="text-body text-label-tertiary">Aucune transaction trouvée</p>
            </div>
          )}

          {hasMore && filteredTransactions.length > 0 && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-xl bg-white/5 border border-separator text-caption font-bold text-label-secondary hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Chargement...' : 'Charger plus'}
              </button>
            </div>
          )}
        </PullToRefreshWrapper>
      </div>

      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={editingTransaction}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
        categories={categories as string[]}
        accounts={accounts as string[]}
      />

      <MTransactionFilterModal
        isOpen={isFilterModalOpen}
        filters={filters}
        onFiltersChange={updateFilters}
        onReset={resetFilters}
        onClose={() => setIsFilterModalOpen(false)}
        accounts={accounts}
        categories={categories}
        onPointAll={pointAll}
        onUnpointAll={unpointAll}
      />

      <BulkActionDialog
        mode={bulkDialog}
        count={selectedCount}
        categories={categories}
        onClose={() => setBulkDialog(null)}
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
};
