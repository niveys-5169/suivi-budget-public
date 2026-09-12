import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTransactionContext, Transaction } from '../../../context/TransactionContext';
import { AurumTransactionDetail } from './AurumTransactionDetail';
import { Search, Filter, ArrowUpDown, Check, Repeat2, Download } from 'lucide-react';
import { exportTransactionsToExcel } from '../../../utils/exportTransactionsExcel';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { IconButton } from '../../../ui';
import { CategoryIcon } from '../../CategoryIcon';
import { getCategoryMeta } from '../../../constants/categoryMetadata';
import { formatCurrency } from '../../../lib/formatters';
import { useRecurrences } from '../../../hooks/useRecurrences';
import { useAppState } from '../../../context/AppStateContext';
import { MonthNavigator } from '../../shared/MonthNavigator';
import { getDayOfMonth } from '../../../utils/recurrenceEngine';

export const AurumTransactionsPage: React.FC = () => {
  const {
    transactions,
    filteredTransactions,
    filters,
    updateFilters,
    saveTransaction,
    deleteTransaction,
    togglePointe,
    loading,
  } = useTransactionContext();

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportTransactionsToExcel(transactions);
    } finally {
      setExporting(false);
    }
  }, [transactions]);
  const { setMonthKey } = useAppState();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const {
    mappings: { linkedTxToRecurrence, candidateTxToRecurrence },
    ignoredTxIds,
    ignoreTxMatch,
    link,
  } = useRecurrences();

  // Derive the current month as a Date from the transaction filters (source of truth for what's displayed)
  const currentMonth = useMemo(() => {
    const y = parseInt(filters.year || String(new Date().getFullYear()), 10);
    const m = parseInt(filters.month || String(new Date().getMonth() + 1), 10);
    return new Date(y, m - 1, 1);
  }, [filters.year, filters.month]);

  // Keep monthKey (used by reconciliation hook) in sync with the displayed month
  useEffect(() => {
    const y = filters.year || String(new Date().getFullYear());
    const m = (filters.month || String(new Date().getMonth() + 1)).padStart(2, '0');
    setMonthKey(`${y}-${m}`);
  }, [filters.year, filters.month, setMonthKey]);

  const handleMonthChange = useCallback(
    (date: Date) => {
      const y = String(date.getFullYear());
      const m = String(date.getMonth() + 1).padStart(2, '0');
      updateFilters({ year: y, month: m });
    },
    [updateFilters],
  );

  // Day-Cluster Grouping Logic
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((tx) => {
      // Use date string as key (YYYY-MM-DD) — tx.date est déjà normalisée en
      // ISO ; pas de round-trip Date/UTC qui peut décaler le jour selon le fuseau.
      const date = tx.date ? String(tx.date).slice(0, 10) : 'undated';
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
    });
    // Sort dates descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/10 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  // Animation Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 20,
      },
    },
  };

  return (
    <div className="min-h-screen bg-[#0B0B14] text-white font-sans overflow-x-hidden selection:bg-gold/30">
      {/* Background Ambience (FLUX Design) */}
      <div className="fixed inset-0 bg-[#0B0B14] -z-20" />
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full -z-10" />

      {/* Header (Sticky) */}
      <div className="px-6 md:px-24 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8 sticky top-0 bg-[#0B0B14]/80 backdrop-blur-2xl z-40 border-b border-separator">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tighter text-white">Flux Bancaires</h1>
          <div className="flex items-center gap-4">
            <MonthNavigator month={currentMonth} onChange={handleMonthChange} />
            <button
              onClick={handleExport}
              disabled={exporting || !transactions.length}
              title={`Exporter ${transactions.length} transactions en Excel`}
              className="w-12 h-12 rounded-xl bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-gold hover:border-gold/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <span className="w-4 h-4 border border-gold/30 border-t-gold rounded-full animate-spin" />
              ) : (
                <Download size={20} />
              )}
            </button>
            <button className="w-12 h-12 rounded-xl bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <ArrowUpDown size={20} />
            </button>
            <button className="w-12 h-12 rounded-xl bg-surface border border-separator flex items-center justify-center text-white/40 hover:text-white transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </div>
      </div>

      <motion.main
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="px-6 md:px-24 pt-8 space-y-8 pb-48"
      >
        {groupedTransactions.map(([date, transactions]) => (
          <motion.div key={date} variants={containerVariants} className="space-y-4">
            {/* Sticky Day Header */}
            <div className="sticky top-[calc(env(safe-area-inset-top)+6rem)] z-30 py-6 bg-bg backdrop-blur-md -mx-6 md:-mx-24 px-6 md:px-24 border-b border-separator">
              <h3 className="text-caption font-semibold text-label-tertiary">
                {new Date(date).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
            </div>

            <div className="space-y-4 pt-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="space-y-2">
                  <motion.div
                    variants={itemVariants}
                    whileHover={{
                      y: -4,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 30px 60px -12px rgba(0,0,0,0.5)',
                    }}
                    onClick={() => setSelectedTx(tx)}
                    className="group flex items-center justify-between px-6 py-10 rounded-xl bg-surface border border-separator transition-all cursor-pointer overflow-visible"
                  >
                    <div className="flex items-center gap-6 max-w-[65%]">
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <CategoryIcon
                          icon={getCategoryMeta(tx.categorie || '').icon}
                          size={24}
                          color={getCategoryMeta(tx.categorie || '').color}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-subhead font-semibold text-white tracking-tight">
                            {tx.libelle || 'Transaction sans libellé'}
                          </p>
                        </div>
                        <p className="text-caption font-medium text-label-tertiary mt-1">
                          {tx.categorie || 'Autre'} • {tx.compte || 'Compte inconnu'}
                        </p>
                        {/* Persistent badge if linked */}
                        {linkedTxToRecurrence[tx.id] && (
                          <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-full bg-positive/15 border border-positive text-positive text-caption font-bold">
                            <Repeat2 size={11} />
                            {linkedTxToRecurrence[tx.id]!.label}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end gap-2">
                        <p
                          className={`font-serif text-body font-bold tabular-nums shrink-0 ${(tx.montant || 0) > 0 ? 'text-gold' : 'text-label'}`}
                        >
                          {(tx.montant || 0) > 0 ? '+' : ''}
                          {formatCurrency(tx.montant || 0)}
                        </p>
                        {linkedTxToRecurrence[tx.id] && (
                          <Repeat2 size={13} className="text-positive" />
                        )}
                      </div>
                      {/* Pointage rapide : bascule sans ouvrir la modale de détail. */}
                      <IconButton
                        label={tx.pointe ? 'Dépointée' : 'Pointer'}
                        size="sm"
                        variant="plain"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePointe(tx.id, !tx.pointe);
                        }}
                        className={`!rounded-full border shrink-0 ${
                          tx.pointe
                            ? 'border-gold/40 !bg-gold/20 !text-gold'
                            : 'border-separator hover:!text-label'
                        }`}
                      >
                        <Check size={16} />
                      </IconButton>
                    </div>
                  </motion.div>

                  {/* Suggestion banner */}
                  {candidateTxToRecurrence[tx.id] && !ignoredTxIds.includes(tx.id) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mx-2 p-4 rounded-xl bg-gold/5 border border-gold/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔗</span>
                        <p className="text-xs font-semibold text-gold-light">
                          Correspondance détectée avec la récurrence{' '}
                          <strong className="text-white">
                            {candidateTxToRecurrence[tx.id]!.label}
                          </strong>{' '}
                          (prévue le {getDayOfMonth(candidateTxToRecurrence[tx.id]!)})
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => link(candidateTxToRecurrence[tx.id]!, tx)}
                          className="px-4 py-2 rounded-lg bg-gold text-bg text-xs font-semibold hover:bg-gold-light transition-all shadow-md shadow-gold/10"
                        >
                          Lier & Pointer
                        </button>
                        <button
                          onClick={() => ignoreTxMatch(tx.id)}
                          className="px-4 py-2 rounded-lg bg-white/5 border border-separator text-white/60 text-xs font-semibold hover:bg-white/10 hover:text-white transition-all"
                        >
                          Ignorer
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {filteredTransactions.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-label-tertiary">
              <Search size={32} />
            </div>
            <p className="text-sm font-bold text-label-tertiary">Aucun flux trouvé</p>
          </div>
        )}
      </motion.main>

      <AnimatePresence>
        {selectedTx && (
          <AurumTransactionDetail
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onSave={saveTransaction}
            onDelete={deleteTransaction}
          />
        )}
      </AnimatePresence>

      {/* Floating Search Island */}
      <div className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-3.5rem)] max-w-[600px] z-50">
        <div className="relative bg-white/[0.05] backdrop-blur-2xl border border-white/[0.1] rounded-lg overflow-hidden group focus-within:border-gold/30 focus-within:bg-white/[0.08] transition-all duration-500">
          <Search
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-gold transition-colors"
            size={20}
          />
          <input
            placeholder="Rechercher une transaction, un montant..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-full h-16 bg-transparent pl-16 pr-8 text-sm font-semibold text-white focus:outline-none transition-all placeholder:text-label-tertiary"
          />
        </div>
      </div>
    </div>
  );
};
