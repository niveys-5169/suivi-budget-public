import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import {
  Pencil,
  X,
  Save,
  Wallet,
  Sparkles,
  AlertTriangle,
  Check,
  LayoutGrid,
  CheckSquare,
} from 'lucide-react';
import { db } from '../../services/firebase';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgetContext } from '../../context/BudgetContext';
import { useGlobalData } from '../../context/GlobalDataContext';
import { fmt, parseDecimal } from '../../utils/format';
import { ravConfigSchema, type RavConfigFormValues } from '../../lib/schemas/forms';
import { CategoryTagSection } from './CategoryTagSection';
import { RavSummaryBar } from './RavSummaryBar';
import { computeDerivedRav } from '../../utils/ravCalculations';
import { withRetry } from '../../utils/withRetry';

const EMPTY_CONFIG: RavConfigFormValues = {
  revenu_mensuel_net: null,
  provision_salaires: {},
  revenu_categories: [],
  depense_categories: [],
  included_accounts: [],
};

interface Props {
  monthKey: string;
  onClose?: () => void;
}

export const RAVEditor: React.FC<Props> = ({ monthKey, onClose }) => {
  const { formatMessage: t } = useIntl();
  const { transactions } = useTransactions();
  const { getBudgetCategoryCandidates } = useBudgetContext();
  const { accountBalances: balances, ravConfig: globalRavConfig, recurrences } = useGlobalData();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<RavConfigFormValues>({
    resolver: zodResolver(ravConfigSchema),
    defaultValues: EMPTY_CONFIG,
  });

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newIncome, setNewIncome] = useState('');
  const [newExpense, setNewExpense] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState<'income' | 'expense' | null>(null);

  const persistedConfig: RavConfigFormValues = useMemo(() => {
    if (!globalRavConfig) return EMPTY_CONFIG;
    const next: RavConfigFormValues = {
      revenu_mensuel_net: globalRavConfig.revenu_mensuel_net ?? null,
      provision_salaires: globalRavConfig.provision_salaires ?? {},
      revenu_categories: globalRavConfig.revenu_categories ?? [],
      depense_categories: globalRavConfig.depense_categories ?? [],
      included_accounts: globalRavConfig.included_accounts ?? [],
    };
    if (
      globalRavConfig.revenu_mensuel_net &&
      (!globalRavConfig.provision_salaires ||
        Object.keys(globalRavConfig.provision_salaires).length === 0)
    ) {
      next.provision_salaires = {
        nico: { montant: globalRavConfig.revenu_mensuel_net, categorie: 'Salaire Nico' },
      };
    }
    return next;
  }, [globalRavConfig]);

  useEffect(() => {
    if (!editing) reset(persistedConfig);
  }, [persistedConfig, editing, reset]);

  const activeRecurrences = useMemo(() => recurrences.filter((r) => r.active), [recurrences]);

  const txList = useMemo(() => transactions ?? [], [transactions]);

  const candidateCategories = useMemo(() => {
    const fromTx = Array.from(new Set(txList.map((t) => (t.categorie || '').trim()))).filter(
      Boolean,
    );
    const fromBudget = getBudgetCategoryCandidates();
    return Array.from(new Set([...fromTx, ...fromBudget])).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [txList, getBudgetCategoryCandidates]);

  const computedFromConfig = useCallback(
    (cfg: RavConfigFormValues) =>
      computeDerivedRav(cfg, { monthKey, txList, recurrences: activeRecurrences }),
    [monthKey, txList, activeRecurrences],
  );

  const watchedDraft = watch();
  const liveCurrent = useMemo(
    () => computedFromConfig(persistedConfig),
    [persistedConfig, computedFromConfig],
  );
  const livePreview = useMemo(
    () => computedFromConfig(watchedDraft),
    [watchedDraft, computedFromConfig],
  );

  const beginEdit = () => {
    reset(persistedConfig);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    reset(persistedConfig);
    setEditing(false);
    setError(null);
    setNewIncome('');
    setNewExpense('');
    setShowCategoryPicker(null);
  };

  const onSubmit = async (values: RavConfigFormValues) => {
    setError(null);
    try {
      const newConfig = { ...values, revenu_mensuel_net: null };
      await withRetry(() => setDoc(doc(db, 'metadata', 'rav_config'), newConfig, { merge: true }));
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t({ id: 'rav.error.saveFailed' });
      setError(msg);
    }
  };

  const toggleAccount = (accId: string) => {
    const current = getValues('included_accounts');
    const next = current.includes(accId)
      ? current.filter((id) => id !== accId)
      : [...current, accId];
    setValue('included_accounts', next, { shouldDirty: true });
  };

  const toggleCategory = (cat: string, type: 'income' | 'expense') => {
    const field = type === 'income' ? 'revenu_categories' : 'depense_categories';
    const current = getValues(field);
    const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
    setValue(field, next, { shouldDirty: true });
  };

  const addIncome = () => {
    const v = newIncome.trim();
    if (!v) return;
    const current = getValues('revenu_categories');
    if (current.includes(v)) {
      setError(t({ id: 'rav.error.duplicate' }));
      return;
    }
    setValue('revenu_categories', [...current, v], { shouldDirty: true });
    setNewIncome('');
    setError(null);
  };

  const addExpense = () => {
    const v = newExpense.trim();
    if (!v) return;
    const current = getValues('depense_categories');
    if (current.includes(v)) {
      setError(t({ id: 'rav.error.duplicate' }));
      return;
    }
    setValue('depense_categories', [...current, v], { shouldDirty: true });
    setNewExpense('');
    setError(null);
  };

  const draftIncluded = watchedDraft.included_accounts ?? [];
  const draftRevenu = watchedDraft.revenu_categories ?? [];
  const draftDepense = watchedDraft.depense_categories ?? [];
  const draftDepenseCount = persistedConfig.depense_categories.length;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-2 md:mx-4 my-6 rounded-xl bg-raised border border-separator backdrop-blur-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between p-6 md:p-8 border-b border-separator">
        <div className="space-y-1">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-gold/60" />
            <span className="text-caption font-semibold text-gold/60">
              {t({ id: 'rav.eyebrow' })}
            </span>
          </div>
          <h3 className="text-lg md:text-xl font-bold text-white tracking-tight">
            {t({ id: 'rav.title' })}{' '}
            <span className="text-gold">{t({ id: 'rav.title.emphasis' })}</span>
            <span className="text-label/30 font-light text-sm ml-4 normal-case">
              {t({ id: 'rav.mode' }, { mode: liveCurrent.modeLabel })}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={beginEdit}
              className="px-4 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold hover:bg-gold hover:text-bg transition-all text-caption font-semibold flex items-center gap-2"
            >
              <Pencil size={12} aria-hidden="true" /> {t({ id: 'rav.action.configure' })}
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 h-10 rounded-xl bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all text-caption font-semibold flex items-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-3 h-3 border-2 border-bg/20 border-t-ink rounded-full animate-spin" />
                ) : (
                  <Save size={12} aria-hidden="true" />
                )}
                {t({ id: 'rav.action.save' })}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={isSubmitting}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 hover:text-white transition-all"
                title={t({ id: 'rav.action.cancel' })}
                aria-label={t({ id: 'rav.action.cancel' })}
              >
                <X size={14} />
              </button>
            </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-separator text-label/40 hover:text-white hover:bg-white/10 transition-all"
              aria-label={t({ id: 'rav.action.close.aria' })}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <RavSummaryBar summary={liveCurrent} expenseCategoryCount={draftDepenseCount} />

      <AnimatePresence>
        {error && (
          <motion.div
            role="alert"
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

      {editing && (
        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <div className="space-y-4">
                  <label
                    htmlFor="rav-prov-nico"
                    className="text-caption font-semibold text-label/40 flex items-center gap-2"
                  >
                    <Wallet size={11} className="text-gold" aria-hidden="true" />{' '}
                    {t({ id: 'rav.form.provisions' })}
                  </label>
                  <input
                    id="rav-prov-nico"
                    type="text"
                    inputMode="decimal"
                    placeholder={t({ id: 'rav.form.provision.nico.placeholder' })}
                    aria-label={t({ id: 'rav.form.provision.nico.placeholder' })}
                    {...register('provision_salaires.nico.montant', {
                      setValueAs: (v) => parseDecimal(String(v ?? '')) ?? 0,
                    })}
                    onBlur={() => {
                      const cat = getValues('provision_salaires.nico.categorie');
                      if (!cat) setValue('provision_salaires.nico.categorie', 'Salaire Nico');
                    }}
                    className="h-11 w-full rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all font-serif font-bold"
                  />
                  <input
                    id="rav-prov-gwen"
                    type="text"
                    inputMode="decimal"
                    placeholder={t({ id: 'rav.form.provision.gwen.placeholder' })}
                    aria-label={t({ id: 'rav.form.provision.gwen.placeholder' })}
                    {...register('provision_salaires.gwen.montant', {
                      setValueAs: (v) => parseDecimal(String(v ?? '')) ?? 0,
                    })}
                    onBlur={() => {
                      const cat = getValues('provision_salaires.gwen.categorie');
                      if (!cat) setValue('provision_salaires.gwen.categorie', 'Salaire Gwen');
                    }}
                    className="h-11 w-full rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all font-serif font-bold"
                  />
                </div>
              </div>

              <div>
                <p
                  id="rav-accounts-label"
                  className="text-caption font-semibold text-label/40 flex items-center gap-2 mb-4"
                >
                  <LayoutGrid size={11} className="text-gold" aria-hidden="true" />{' '}
                  {t({ id: 'rav.form.accounts' })}
                </p>
                <Controller
                  control={control}
                  name="included_accounts"
                  render={() => (
                    <div
                      role="group"
                      aria-labelledby="rav-accounts-label"
                      className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar"
                    >
                      {balances.map((acc) => {
                        const selected = draftIncluded.includes(acc.id);
                        return (
                          <button
                            type="button"
                            key={acc.id}
                            onClick={() => toggleAccount(acc.id)}
                            aria-pressed={selected}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                              selected
                                ? 'bg-gold/10 border-gold/30 text-white'
                                : 'bg-white/5 border-separator text-label/40 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex flex-col items-start">
                              <span className="text-caption font-bold">{acc.compte}</span>
                              <span className="text-caption opacity-60 font-serif">
                                {fmt(acc.current_balance)}
                              </span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                                selected
                                  ? 'bg-gold border-gold text-bg'
                                  : 'bg-transparent border-separator text-transparent'
                              }`}
                            >
                              <Check size={12} strokeWidth={4} aria-hidden="true" />
                            </div>
                          </button>
                        );
                      })}
                      {balances.length === 0 && (
                        <div className="text-caption text-label/30 py-4 text-center border border-dashed border-separator rounded-xl">
                          {t({ id: 'rav.form.accounts.empty' })}
                        </div>
                      )}
                    </div>
                  )}
                />
                <p className="text-caption text-label/30 mt-4">
                  {draftIncluded.length > 0
                    ? t({ id: 'rav.form.accounts.filter.some' }, { count: draftIncluded.length })
                    : t({ id: 'rav.form.accounts.filter.all' })}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <Controller
                control={control}
                name="revenu_categories"
                render={() => (
                  <CategoryTagSection
                    label={t({ id: 'rav.form.categories.income' })}
                    tagColor="emerald"
                    tags={draftRevenu}
                    onTogglePicker={() =>
                      setShowCategoryPicker(showCategoryPicker === 'income' ? null : 'income')
                    }
                    isPickerOpen={showCategoryPicker === 'income'}
                    onRemove={(cat) => toggleCategory(cat, 'income')}
                    inputValue={newIncome}
                    onInputChange={setNewIncome}
                    onAdd={addIncome}
                    placeholder={t({ id: 'rav.form.categories.add.placeholder' })}
                    pickerToggleLabel={t({ id: 'rav.form.categories.picker.toggle' })}
                    emptyLabel={t({ id: 'rav.form.categories.empty' })}
                  />
                )}
              />

              <Controller
                control={control}
                name="depense_categories"
                render={() => (
                  <CategoryTagSection
                    label={t({ id: 'rav.form.categories.expense' })}
                    tagColor="ruby"
                    tags={draftDepense}
                    onTogglePicker={() =>
                      setShowCategoryPicker(showCategoryPicker === 'expense' ? null : 'expense')
                    }
                    isPickerOpen={showCategoryPicker === 'expense'}
                    onRemove={(cat) => toggleCategory(cat, 'expense')}
                    inputValue={newExpense}
                    onInputChange={setNewExpense}
                    onAdd={addExpense}
                    placeholder={t({ id: 'rav.form.categories.add.placeholder' })}
                    pickerToggleLabel={t({ id: 'rav.form.categories.picker.toggle' })}
                    emptyLabel={t({ id: 'rav.form.categories.empty' })}
                  />
                )}
              />
            </div>
          </div>

          <AnimatePresence>
            {showCategoryPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="rounded-lg border border-separator bg-raised/80 backdrop-blur-xl p-6 shadow-3xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <CheckSquare size={14} className="text-gold" aria-hidden="true" />
                    <span className="text-caption font-semibold text-white">
                      {t(
                        { id: 'rav.form.categories.picker.title' },
                        {
                          scope:
                            showCategoryPicker === 'income'
                              ? t({ id: 'rav.form.categories.scope.income' })
                              : t({ id: 'rav.form.categories.scope.expense' }),
                        },
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryPicker(null)}
                    className="p-2 rounded-lg hover:bg-white/5 transition-all text-label/40 hover:text-white"
                    aria-label={t({ id: 'action.close' })}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {candidateCategories.map((cat) => {
                    const isSelected =
                      showCategoryPicker === 'income'
                        ? draftRevenu.includes(cat)
                        : draftDepense.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => toggleCategory(cat, showCategoryPicker)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-caption font-bold transition-all text-left ${
                          isSelected
                            ? 'bg-gold/10 border-gold/40 text-gold'
                            : 'bg-white/5 border-separator text-label/40 hover:bg-white/10 hover:border-separator'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-gold border-gold text-bg'
                              : 'bg-transparent border-separator text-transparent'
                          }`}
                        >
                          <Check size={8} strokeWidth={5} aria-hidden="true" />
                        </div>
                        <span className="truncate">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-lg border border-gold/20 bg-gold/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={12} className="text-gold" aria-hidden="true" />
              <span className="text-caption font-semibold text-gold">
                {t({ id: 'rav.preview.title' })}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-caption font-semibold text-label/30">
                  {t({ id: 'rav.preview.rav' })}
                </div>
                <div
                  className={`text-xl font-serif font-bold tabular-nums mt-1 ${livePreview.reste >= 0 ? 'text-gold' : 'text-negative'}`}
                >
                  {fmt(livePreview.reste)}
                </div>
              </div>
              <div>
                <div className="text-caption font-semibold text-label/30">
                  {t({ id: 'rav.preview.income' })}
                </div>
                <div className="text-xl font-serif font-bold text-white tabular-nums mt-1">
                  {fmt(livePreview.revenuRef)}
                </div>
              </div>
              <div>
                <div className="text-caption font-semibold text-label/30">
                  {t({ id: 'rav.preview.expenses' })}
                </div>
                <div className="text-xl font-serif font-bold text-negative tabular-nums mt-1">
                  {fmt(Math.abs(livePreview.totalDep))}
                </div>
              </div>
              <div>
                <div className="text-caption font-semibold text-label/30">
                  {t({ id: 'rav.preview.recurring' })}
                </div>
                <div className="text-xl font-serif font-bold text-warning tabular-nums mt-1">
                  {fmt(Math.abs(livePreview.provisions))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
