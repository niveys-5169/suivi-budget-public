import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  BarChart3,
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useBudgetContext } from '../../context/BudgetContext';
import { fmt } from '../../utils/format';
import { isIncomeBudget } from '../../utils/budgetHelpers';
import {
  sortBudgetsByType,
  computeBudgetTotals,
  computeCandidateCategories,
} from '../../utils/budgetManagerHelpers';
import { useTransactions } from '../../hooks/useTransactions';
import { BudgetProjectionBadge } from './BudgetProjectionBadge';
import { BudgetBase } from '../../types/banking.types';

interface BudgetManagerPanelProps {
  onClose: () => void;
}

interface DraftBudget {
  categorie: string;
  montant: string;
  isIncome: boolean;
}

const INPUT_CLS =
  'h-11 rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all';

export const BudgetManagerPanel: React.FC<BudgetManagerPanelProps> = ({ onClose }) => {
  const { formatMessage: t } = useIntl();
  const {
    budgets,
    viewMode,
    setViewMode,
    monthKey,
    updateBaseBudget,
    updateMonthlyBudget,
    updateAnnualDefault,
    removeBudgetCategory,
    getBudgetCategoryCandidates,
  } = useBudgetContext();
  const { transactions } = useTransactions();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftBudget>({ categorie: '', montant: '', isIncome: false });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const isBudgetIncome = (b: BudgetBase): boolean => isIncomeBudget(b);

  const sortedBudgets = useMemo(() => sortBudgetsByType(budgets), [budgets]);

  const existingCategories = useMemo(
    () => new Set(sortedBudgets.map((b) => String(b.categorie || b.id))),
    [sortedBudgets],
  );

  const candidateCategories = useMemo(() => {
    const fromTx = Array.from(new Set(transactions.map((t) => t.categorie))).filter(
      Boolean,
    ) as string[];
    return computeCandidateCategories(getBudgetCategoryCandidates(), fromTx, existingCategories);
  }, [transactions, getBudgetCategoryCandidates, existingCategories]);

  const totals = useMemo(() => computeBudgetTotals(sortedBudgets), [sortedBudgets]);

  const beginEdit = (b: BudgetBase) => {
    setError(null);
    setConfirmDelete(null);
    setEditingId(b.id);
    setEditingValue(String(Math.round((Number(b.montant) || 0) * 100) / 100));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const commitEdit = async (b: BudgetBase) => {
    const next = parseFloat(editingValue.replace(',', '.'));
    if (!isFinite(next) || next < 0) {
      setError(t({ id: 'budget.manager.error.amountInvalid' }));
      return;
    }
    setSavingId(b.id);
    setError(null);
    const cat = b.categorie || b.id;
    try {
      if (viewMode === 'annual') {
        // Fix the base budget type + value (so monthly display = next/12)
        await updateBaseBudget(cat, next, 'annuel', b.isIncome || b.type === 'revenu');
        // Also write the annual override so the annual view refreshes immediately
        await updateAnnualDefault(cat, next);
      } else {
        // Fix the base budget
        await updateBaseBudget(cat, next, 'mensuel', b.isIncome || b.type === 'revenu');
        // Also write the monthly override so the monthly view refreshes immediately
        await updateMonthlyBudget(cat, next);
      }
      setEditingId(null);
      setEditingValue('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t({ id: 'budget.manager.error.save' });
      setError(msg);
    } finally {
      setSavingId(null);
    }
  };

  const toggleBudgetType = async (b: BudgetBase) => {
    const cat = b.categorie || b.id;
    const isNowIncome = !isBudgetIncome(b);
    setSavingId(b.id);
    try {
      await updateBaseBudget(
        cat,
        Number(b.montant),
        b.type === 'annuel' ? 'annuel' : isNowIncome ? 'revenu' : 'mensuel',
        isNowIncome,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de type');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (categorie: string) => {
    setSavingId(categorie);
    setError(null);
    try {
      await removeBudgetCategory(categorie);
      setConfirmDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t({ id: 'budget.manager.error.delete' });
      setError(msg);
    } finally {
      setSavingId(null);
    }
  };

  const handleAdd = async () => {
    const cat = draft.categorie.trim();
    const val = parseFloat(draft.montant.replace(',', '.'));
    if (!cat) {
      setError(t({ id: 'budget.manager.error.chooseCategory' }));
      return;
    }
    if (existingCategories.has(cat)) {
      setError(t({ id: 'budget.manager.error.duplicate' }));
      return;
    }
    if (!isFinite(val) || val < 0) {
      setError(t({ id: 'budget.manager.error.amountInvalid' }));
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await updateBaseBudget(
        cat,
        val,
        draft.isIncome ? 'revenu' : viewMode === 'annual' ? 'annuel' : 'mensuel',
        draft.isIncome,
      );
      setDraft({ categorie: '', montant: '', isIncome: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t({ id: 'budget.manager.error.create' });
      setError(msg);
    } finally {
      setAdding(false);
    }
  };

  const periodLabel =
    viewMode === 'annual'
      ? t({ id: 'budget.manager.title.annual' })
      : t({ id: 'budget.manager.title.monthly' });
  const periodSubLabel =
    viewMode === 'annual'
      ? t({ id: 'budget.manager.period.year' }, { year: monthKey.split('-')[0] })
      : new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('fr-FR', {
          month: 'long',
          year: 'numeric',
        });

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="mx-2 md:mx-4 my-6 rounded-xl bg-raised border border-separator backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-separator">
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-gold/60 animate-pulse" />
              <span className="text-caption font-semibold text-gold/60">
                {t({ id: 'budget.manager.eyebrow' })}
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">
              {t({ id: 'budget.manager.title' })} <span className="text-gold">{periodLabel}</span>
              <span className="text-label/30 font-light text-sm ml-4 normal-case">
                {periodSubLabel}
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-separator rounded-xl p-1">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 md:px-4 py-2 rounded-lg text-caption font-semibold transition-all flex items-center gap-2 ${
                  viewMode === 'monthly'
                    ? 'bg-gold text-bg shadow shadow-gold/20'
                    : 'text-label/50 hover:text-white'
                }`}
              >
                <Calendar size={12} aria-hidden="true" />{' '}
                {t({ id: 'budget.manager.toggle.monthly' })}
              </button>
              <button
                onClick={() => setViewMode('annual')}
                className={`px-4 md:px-4 py-2 rounded-lg text-caption font-semibold transition-all flex items-center gap-2 ${
                  viewMode === 'annual'
                    ? 'bg-gold text-bg shadow shadow-gold/20'
                    : 'text-label/50 hover:text-white'
                }`}
              >
                <BarChart3 size={12} aria-hidden="true" />{' '}
                {t({ id: 'budget.manager.toggle.annual' })}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 hover:text-white hover:bg-white/10 transition-all"
              aria-label={t({ id: 'budget.manager.close.aria' })}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-white/5">
          <div className="bg-raised px-4 md:px-8 py-4">
            <div className="text-caption font-semibold text-label/30">
              {t({ id: 'budget.manager.stat.categories' })}
            </div>
            <div className="text-2xl font-serif font-semibold text-white tabular-nums mt-1">
              {totals.count}
            </div>
          </div>
          <div className="bg-raised px-4 md:px-8 py-4">
            <div className="text-caption font-semibold text-positive flex items-center gap-1">
              <TrendingUp size={9} aria-hidden="true" /> {t({ id: 'budget.manager.stat.income' })}
            </div>
            <div className="text-2xl font-serif font-semibold text-positive tabular-nums mt-1">
              {fmt(totals.incomeTotal)}
            </div>
          </div>
          <div className="bg-raised px-4 md:px-8 py-4">
            <div className="text-caption font-semibold text-gold/60 flex items-center gap-1">
              <TrendingDown size={9} aria-hidden="true" />{' '}
              {t({ id: 'budget.manager.stat.expenses' })}
            </div>
            <div className="text-2xl font-serif font-semibold text-gold tabular-nums mt-1">
              {fmt(totals.expenseTotal)}
            </div>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-6 md:mx-8 mt-4 rounded-xl bg-negative/10 border border-negative/30 px-4 py-4 flex items-center gap-4"
            >
              <AlertTriangle size={14} className="text-negative flex-shrink-0" aria-hidden="true" />
              <span className="text-caption font-bold text-negative">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Budgets list */}
        <div className="p-4 md:p-6 space-y-2">
          {sortedBudgets.length === 0 && (
            <div className="text-center py-12 text-label/30 text-caption font-semibold">
              {t({ id: 'budget.manager.empty' })}
            </div>
          )}
          {sortedBudgets.map((b: BudgetBase) => {
            const id = b.id;
            const isEditing = editingId === id;
            const isSaving = savingId === id;
            const isDeleting = confirmDelete === id;
            const label = b.nom || b.categorie || id;
            const isIncome = isBudgetIncome(b);
            return (
              <div
                key={id}
                className={`group flex items-center gap-4 px-4 py-4 rounded-xl border transition-all ${
                  isEditing
                    ? 'bg-gold/5 border-gold/30'
                    : isDeleting
                      ? 'bg-negative/5 border-negative/30'
                      : 'bg-surface border-separator hover:bg-white/5 hover:border-separator'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => toggleBudgetType(b)}
                      className="hover:scale-110 transition-transform"
                      title={isIncome ? 'Changer en dépense' : 'Changer en revenu'}
                    >
                      {isIncome ? (
                        <TrendingUp size={12} className="text-positive flex-shrink-0" />
                      ) : (
                        <TrendingDown size={12} className="text-label/30 flex-shrink-0" />
                      )}
                    </button>
                    <span className="text-sm font-bold text-white truncate" title={label}>
                      {label}
                    </span>
                    {!isIncome && (
                      <BudgetProjectionBadge
                        categoryId={b.categorie || id}
                        viewMode={viewMode}
                        monthKey={monthKey}
                      />
                    )}
                  </div>
                  <div
                    className={`text-caption font-semibold mt-1 ml-4 ${isIncome ? 'text-positive' : 'text-label/30'}`}
                  >
                    {isIncome
                      ? b.type === 'annuel'
                        ? t({ id: 'budget.manager.label.incomeAnnual' })
                        : t({ id: 'budget.manager.label.incomeMonthly' })
                      : b.type === 'annuel'
                        ? t({ id: 'budget.manager.label.targetAnnual' })
                        : b.type === 'ponctuel'
                          ? t({ id: 'budget.manager.label.targetOneoff' })
                          : t({ id: 'budget.manager.label.targetMonthly' })}
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={editInputRef}
                      type="text"
                      inputMode="decimal"
                      className={`${INPUT_CLS} w-32 text-right font-serif font-bold`}
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(b);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      disabled={isSaving}
                    />
                    <button
                      onClick={() => commitEdit(b)}
                      disabled={isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all"
                      title={t({ id: 'budget.manager.action.validate' })}
                      aria-label={t({ id: 'budget.manager.action.validate' })}
                    >
                      {isSaving ? (
                        <div className="w-3 h-3 border-2 border-bg/20 border-t-ink rounded-full animate-spin" />
                      ) : (
                        <Check size={14} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 hover:text-white transition-all"
                      title={t({ id: 'action.cancel' })}
                      aria-label={t({ id: 'action.cancel' })}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : isDeleting ? (
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-negative">
                      {t({ id: 'budget.manager.confirm.prompt' })}
                    </span>
                    <button
                      onClick={() => handleDelete(b.categorie || id)}
                      disabled={isSaving}
                      className="px-4 h-9 rounded-xl bg-negative text-white hover:bg-negative/90 disabled:opacity-50 transition-all text-caption font-semibold flex items-center gap-2"
                    >
                      {isSaving ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={12} aria-hidden="true" />
                      )}
                      {t({ id: 'action.delete' })}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      disabled={isSaving}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 hover:text-white transition-all"
                      title={t({ id: 'action.cancel' })}
                      aria-label={t({ id: 'action.cancel' })}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => beginEdit(b)}
                      className="text-base font-serif font-bold text-label tabular-nums hover:text-gold transition-colors"
                      title={t({ id: 'budget.manager.action.editHint' })}
                    >
                      {fmt(Number(b.montant) || 0)}
                    </button>
                    <button
                      onClick={() => beginEdit(b)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 opacity-0 group-hover:opacity-100 hover:text-gold hover:border-gold/30 transition-all"
                      title={t({ id: 'budget.manager.action.editAmount' })}
                      aria-label={t({ id: 'budget.manager.action.editAmount' })}
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDelete(id);
                        setError(null);
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 opacity-0 group-hover:opacity-100 hover:text-negative hover:border-negative/30 transition-all"
                      title={t({ id: 'budget.manager.action.deleteCategory' })}
                      aria-label={t({ id: 'budget.manager.action.deleteCategory' })}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new category */}
        <div className="border-t border-separator p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Plus size={12} className="text-gold/60" aria-hidden="true" />
            <span className="text-caption font-semibold text-gold/60">
              {t({ id: 'budget.manager.add.title' })}
            </span>
          </div>
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
            {candidateCategories.length > 0 ? (
              <select
                className={`${INPUT_CLS} flex-1 w-full`}
                value={draft.categorie}
                onChange={(e) => setDraft({ ...draft, categorie: e.target.value })}
                disabled={adding}
                aria-label={t({ id: 'budget.manager.add.title' })}
              >
                <option value="" className="bg-bg">
                  {t({ id: 'budget.manager.add.existing' })}
                </option>
                {candidateCategories.map((c) => (
                  <option key={c} value={c} className="bg-bg">
                    {c}
                  </option>
                ))}
                <option value="__custom__" className="bg-bg">
                  {t({ id: 'budget.manager.add.custom' })}
                </option>
              </select>
            ) : null}
            {(draft.categorie === '__custom__' || candidateCategories.length === 0) && (
              <input
                type="text"
                placeholder={t({ id: 'budget.manager.add.namePlaceholder' })}
                aria-label={t({ id: 'budget.manager.add.namePlaceholder' })}
                className={`${INPUT_CLS} flex-1 w-full`}
                value={draft.categorie === '__custom__' ? '' : draft.categorie}
                onChange={(e) => setDraft({ ...draft, categorie: e.target.value })}
                disabled={adding}
              />
            )}
            <input
              type="text"
              inputMode="decimal"
              placeholder={
                viewMode === 'annual'
                  ? t({ id: 'budget.manager.add.targetAnnualPlaceholder' })
                  : t({ id: 'budget.manager.add.targetMonthlyPlaceholder' })
              }
              aria-label={
                viewMode === 'annual'
                  ? t({ id: 'budget.manager.add.targetAnnualPlaceholder' })
                  : t({ id: 'budget.manager.add.targetMonthlyPlaceholder' })
              }
              className={`${INPUT_CLS} md:w-44 font-serif font-bold text-right w-full`}
              value={draft.montant}
              onChange={(e) => setDraft({ ...draft, montant: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              disabled={adding}
            />
            <label className="flex items-center gap-2 px-4 h-11 bg-white/5 border border-separator rounded-xl cursor-pointer hover:bg-white/10 transition-all shrink-0">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-separator bg-transparent text-gold focus:ring-gold/40"
                checked={draft.isIncome}
                onChange={(e) => setDraft({ ...draft, isIncome: e.target.checked })}
              />
              <span className="text-caption font-semibold text-label/60">Revenu</span>
            </label>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="h-11 px-4 rounded-xl bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all text-caption font-semibold flex items-center justify-center gap-2 w-full md:w-auto"
            >
              {adding ? (
                <div className="w-3 h-3 border-2 border-bg/20 border-t-ink rounded-full animate-spin" />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              {t({ id: 'budget.manager.add.action' })}
            </button>
          </div>
          <p className="text-caption text-label/30 mt-4 px-1">
            {t(
              { id: 'budget.manager.add.hint' },
              {
                period:
                  viewMode === 'annual'
                    ? t({ id: 'budget.manager.add.hint.period.annual' })
                    : t({ id: 'budget.manager.add.hint.period.monthly' }),
              },
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
