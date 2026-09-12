import React, { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  useTransactions,
  type Transaction,
  type TransactionFilters as ContextFilters,
} from '../hooks/useTransactions';
import { TransactionFilters } from './TransactionFilters';
import { TransactionGroupedList } from './transactions/TransactionGroupedList';
import { BulkActionsBar } from './transactions/BulkActionsBar';
import { BulkActionDialog, type BulkDialogMode } from './transactions/BulkActionDialog';
import { TransactionFormModal } from './TransactionFormModal';
import { BalancesPanel } from './BalancesPanel';
import { PullToRefreshWrapper } from './PullToRefreshWrapper';
import { useBalances } from '../hooks/useBalances';
import { deriveAccountOptions } from '../hooks/useFormOptions';
import { useBudget } from '../hooks/useBudget';
import { useRecurrences } from '../hooks/useRecurrences';
import { useSyncTransactions } from '../hooks/useSyncTransactions';
import { useTransactionSelection } from '../hooks/useTransactionSelection';
import {
  LayoutPanelTop,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  RefreshCcw,
  CheckSquare,
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { hideLoader } from '../utils/loader';
import { toast } from '../lib/toast';
import { PageHeader } from './shared/PageHeader';
import { Card } from './shared/Card';
import { Button } from './shared/Button';
import { confirm } from '../lib/confirm';

export const TransactionsSection: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const {
    transactions,
    filteredTransactions,
    filters,
    updateFilters,
    resetFilters,
    togglePointe,
    deleteTransaction,
    saveTransaction,
    pointAll,
    unpointAll,
    bulkUpdate,
    bulkDelete,
    bulkSetPointe,
    loadingMore,
    hasMore,
    loadMore,
  } = useTransactions();

  const { getBudgetCategoryCandidates } = useBudget();
  const { balances } = useBalances();
  const { sync, isSyncing } = useSyncTransactions();
  const {
    mappings: { linkedTxToRecurrence },
  } = useRecurrences();
  const linkedTxIds = useMemo(
    () => new Set(Object.keys(linkedTxToRecurrence)),
    [linkedTxToRecurrence],
  );

  const selection = useTransactionSelection();
  const { selectionMode, selectedIds } = selection;

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const [bulkDialog, setBulkDialog] = useState<BulkDialogMode | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  React.useEffect(() => {
    hideLoader();
  }, []);

  // Dynamic categories list
  const categories = useMemo(() => {
    const candidates = getBudgetCategoryCandidates();
    const fromCurrentTxs = new Set(
      transactions.map((t) => (t.categorie || '').trim()).filter(Boolean),
    );
    return Array.from(new Set([...candidates, ...fromCurrentTxs])).sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
  }, [getBudgetCategoryCandidates, transactions]);

  React.useEffect(() => {
    const handleOpenAdd = () => {
      setEditingTransaction(null);
      setIsModalOpen(true);
    };
    const handleOpenEdit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = detail?.id;
      if (id) {
        const tx = transactions.find((t) => t.id === id);
        if (tx) {
          setEditingTransaction(tx);
          setIsModalOpen(true);
        }
      }
    };

    window.addEventListener('open-add-transaction', handleOpenAdd);
    window.addEventListener('open-edit-transaction', handleOpenEdit);
    return () => {
      window.removeEventListener('open-add-transaction', handleOpenAdd);
      window.removeEventListener('open-edit-transaction', handleOpenEdit);
    };
  }, [transactions]);

  const accounts = useMemo(() => deriveAccountOptions(balances), [balances]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  }, []);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      setEditingTransaction(tx);
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    const tx = transactions.find((tr) => tr.id === id);
    if (
      tx &&
      (await confirm({
        message: t({ id: 'tx.page.deleteConfirm' }, { label: tx.libelle, date: tx.date }),
        danger: true,
      }))
    ) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('Failed to delete transaction', err);
      }
    }
  };

  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredTransactions.length > 0 && selectedCount === filteredTransactions.length;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      selection.clear();
    } else {
      selection.selectAll(filteredTransactions.map((tx) => tx.id));
    }
  };

  const handleBulkPointe = async (pointe: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkSetPointe(ids, pointe);
      toast.success(
        t(
          { id: pointe ? 'tx.bulk.toast.pointed' : 'tx.bulk.toast.unpointed' },
          { count: ids.length },
        ),
      );
      selection.exitSelection();
    } catch {
      /* erreur déjà signalée via handleFsError */
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkConfirm = async (mode: BulkDialogMode, value?: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (mode === 'delete') {
      await bulkDelete(ids);
      toast.success(t({ id: 'tx.bulk.toast.deleted' }, { count: ids.length }));
    } else {
      const patch =
        mode === 'rename'
          ? { libelle: value }
          : mode === 'categorize'
            ? { categorie: value }
            : { moisAffectation: value };
      await bulkUpdate(ids, patch);
      toast.success(t({ id: 'tx.bulk.toast.updated' }, { count: ids.length }));
    }
    selection.exitSelection();
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <PullToRefreshWrapper onRefresh={sync} disabled={isSyncing}>
      <div className="pt-0">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8 overflow-visible"
        >
          {/* Header Section */}
          <PageHeader
            icon={<Activity size={24} />}
            title={t({ id: 'tx.page.title' })}
            subtitle={t({ id: 'tx.page.subtitle' })}
            rightActions={
              <>
                <Button
                  variant="ghost"
                  onClick={sync}
                  loading={isSyncing}
                  title={t({ id: 'tx.page.sync.title' })}
                >
                  <RefreshCcw size={16} aria-hidden="true" />
                  <span className="hidden md:inline">
                    {isSyncing ? t({ id: 'state.sync.short' }) : t({ id: 'tx.page.sync.action' })}
                  </span>
                </Button>
                <Button
                  variant={selectionMode ? 'primary' : 'ghost'}
                  onClick={selection.toggleSelectionMode}
                  title={t({ id: 'tx.bulk.select' })}
                >
                  <CheckSquare size={18} aria-hidden="true" />
                  <span>{t({ id: 'tx.bulk.select' })}</span>
                </Button>
                <Button variant="ghost" onClick={() => setShowBalances(!showBalances)}>
                  <LayoutPanelTop size={18} aria-hidden="true" />
                  <span className="hidden md:inline">
                    {showBalances
                      ? t({ id: 'tx.page.balances.hide' })
                      : t({ id: 'tx.page.balances.show' })}
                  </span>
                  {showBalances ? (
                    <ChevronUp size={16} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} aria-hidden="true" />
                  )}
                </Button>
                <Button variant="primary" onClick={handleOpenAdd}>
                  <Plus size={20} aria-hidden="true" />
                  <span className="hidden md:inline">{t({ id: 'tx.page.new' })}</span>
                </Button>
              </>
            }
          />

          {/* Balances Panel (Collapsible) */}
          <AnimatePresence>
            {showBalances && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 40 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                className="overflow-hidden px-4 md:px-0"
              >
                <Card padding="lg">
                  <BalancesPanel />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters outside motion.div: Framer Motion's transform leaves a stacking context
              that would lift the sticky bar above the modal backdrop. */}
          <div className="sticky top-below-header z-40 -mx-4 md:-mx-10 px-4 md:px-10 py-4 bg-bg/80 backdrop-blur-xl border-b border-separator">
            <TransactionFilters
              filters={filters}
              onFilterChange={(name, value) =>
                updateFilters({ [name]: value } as Partial<ContextFilters>)
              }
              onReset={resetFilters}
              onPointAll={pointAll}
              onUnpointAll={unpointAll}
              categories={categories}
              years={years}
              accounts={accounts}
            />
          </div>

          {/* Bulk actions bar (selection mode) */}
          {selectionMode && selectedCount > 0 && (
            <BulkActionsBar
              count={selectedCount}
              allSelected={allFilteredSelected}
              busy={bulkBusy}
              onSelectAll={handleToggleSelectAll}
              onClear={selection.exitSelection}
              onRename={() => setBulkDialog('rename')}
              onCategorize={() => setBulkDialog('categorize')}
              onAssignMonth={() => setBulkDialog('month')}
              onPoint={() => handleBulkPointe(true)}
              onUnpoint={() => handleBulkPointe(false)}
              onDelete={() => setBulkDialog('delete')}
            />
          )}

          {/* List Section */}
          <motion.div variants={itemVariants} className="space-y-8">
            <div className="px-2">
              <TransactionGroupedList
                transactions={filteredTransactions}
                onOpenDetail={handleOpenEdit}
                onTogglePointe={togglePointe}
                onDelete={handleDelete}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={selection.toggleSelect}
                linkedTxIds={linkedTxIds}
              />

              {hasMore && (
                <div className="mt-16 flex justify-center pb-12">
                  <Button
                    variant="ghost"
                    onClick={loadMore}
                    loading={loadingMore}
                    className="px-12 py-4 text-caption font-semibold"
                  >
                    {t({ id: 'tx.page.loadMore' })}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>

        <TransactionFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          transaction={editingTransaction}
          categories={categories}
          accounts={accounts}
        />

        <BulkActionDialog
          mode={bulkDialog}
          count={selectedCount}
          categories={categories}
          onClose={() => setBulkDialog(null)}
          onConfirm={handleBulkConfirm}
        />
      </div>
    </PullToRefreshWrapper>
  );
};
