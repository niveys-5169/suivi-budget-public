import React, { useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { createBudget, updateBudget, suggestBudgetAmount } from '../../api/budgets';
import { buildBudgetDefaults, buildBudgetPayload, periodeTypeFor } from '../../lib/budgetForm';
import { useBudgetContext } from '../../context/BudgetContext';
import { useTransactions } from '../../hooks/useTransactions';
import { Sparkles, Save } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { budgetFormSchema, type BudgetFormValues } from '../../lib/schemas/forms';
import { useFirestoreErrorHandler } from '../../hooks/useFirestoreErrorHandler';
import { MoneyInput } from '../shared/MoneyInput';
import type { MessageId } from '../../i18n/messages/fr';

import { BudgetBase } from '../../types/banking.types';

const TYPE_LABEL_ID: Record<BudgetFormValues['type'], MessageId> = {
  mensuel: 'budget.form.type.monthly',
  annuel: 'budget.form.type.annual',
  ponctuel: 'budget.form.type.oneoff',
};

const SENS_LABEL_ID: Record<BudgetFormValues['sens'], MessageId> = {
  auto: 'budget.form.sens.auto',
  entree: 'budget.form.sens.income',
  sortie: 'budget.form.sens.expense',
};

interface BudgetFormModalProps {
  budget?: BudgetBase;
  onClose: () => void;
  onSave: () => void;
}

const INPUT_CLS =
  'h-11 rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all w-full';
const LABEL_CLS = 'text-caption font-semibold text-label-tertiary mb-2 ml-1';
const ERROR_CLS = 'text-caption font-bold text-negative mt-1 ml-1';

export const BudgetFormModal: React.FC<BudgetFormModalProps> = ({ budget, onClose, onSave }) => {
  const { formatMessage: t } = useIntl();
  const { handle: handleFsError } = useFirestoreErrorHandler();
  const { updateAnnualDefault } = useBudgetContext();
  const [suggesting, setSuggesting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: buildBudgetDefaults(budget),
  });

  const { transactions: allTx } = useTransactions();
  const categories = Array.from(new Set(allTx.map((t) => t.categorie)))
    .filter(Boolean)
    .sort();
  const comptes = Array.from(new Set(allTx.map((t) => t.compte)))
    .filter(Boolean)
    .sort();

  const watchedType = useWatch({ control, name: 'type' });
  const watchedSens = useWatch({ control, name: 'sens' });
  const watchedMoisAttendus = useWatch({ control, name: 'moisAttendus' });

  const handleSuggest = async () => {
    const { categorie, type } = getValues();
    if (!categorie) {
      setSubmitError(t({ id: 'budget.form.suggest.needsCategory' }));
      return;
    }
    setSubmitError(null);
    setSuggesting(true);
    try {
      const amount = await suggestBudgetAmount(categorie);
      const finalAmount = type === 'annuel' ? amount * 12 : amount;
      setValue('montant', finalAmount, { shouldDirty: true, shouldValidate: true });
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const onSubmit = async (values: BudgetFormValues) => {
    setSubmitError(null);
    const payload = buildBudgetPayload(values);
    try {
      if (budget?.id) {
        await updateBudget(budget.id, payload);
        if (values.type === 'annuel') {
          await updateAnnualDefault(values.categorie, Number(values.montant) || 0);
        }
      } else {
        await createBudget(payload);
      }
      onSave();
    } catch (err) {
      // Centralised handler: toast + Sentry + classification. Inline banner
      // mirrors the localized message so screen-reader users see it via role="alert".
      const handled = handleFsError(err, {
        context: budget?.id ? 'budget.update' : 'budget.create',
        extras: { type: values.type, categorie: values.categorie },
      });
      setSubmitError(handled.message);
    }
  };

  const handleTypeChange = (type: BudgetFormValues['type']) => {
    setValue('type', type, { shouldDirty: true, shouldValidate: true });
    setValue('periode.type', periodeTypeFor(type), { shouldDirty: true });
    if (type !== 'annuel') {
      setValue('moisAttendus', [], { shouldDirty: true });
    }
  };

  const toggleMonth = (month: number) => {
    const current = getValues('moisAttendus') || [];
    const next = current.includes(month)
      ? current.filter((m) => m !== month)
      : [...current, month].sort((a, b) => a - b);
    setValue('moisAttendus', next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={budget ? t({ id: 'budget.form.title.edit' }) : t({ id: 'budget.form.title.new' })}
      subtitle={t({ id: 'budget.form.subtitle' })}
      variant="sheet"
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-8" noValidate>
        {submitError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-negative/10 border border-negative/20 text-negative text-caption font-semibold"
          >
            {submitError}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col">
            <label htmlFor="bf-nom" className={LABEL_CLS}>
              {t({ id: 'budget.form.name' })}
            </label>
            <input
              id="bf-nom"
              type="text"
              aria-invalid={!!errors.nom}
              {...register('nom')}
              className={INPUT_CLS}
              placeholder={t({ id: 'budget.form.name.placeholder' })}
            />
            {errors.nom && (
              <p role="alert" className={ERROR_CLS}>
                {errors.nom.message}
              </p>
            )}
          </div>

          <div className="flex flex-col">
            <label htmlFor="bf-categorie" className={LABEL_CLS}>
              {t({ id: 'budget.form.category' })}
            </label>
            <select
              id="bf-categorie"
              aria-invalid={!!errors.categorie}
              {...register('categorie')}
              className={INPUT_CLS}
            >
              <option value="" className="bg-bg">
                {t({ id: 'budget.form.category.placeholder' })}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-bg">
                  {cat}
                </option>
              ))}
            </select>
            {errors.categorie && (
              <p role="alert" className={ERROR_CLS}>
                {errors.categorie.message}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <label className={LABEL_CLS}>{t({ id: 'budget.form.type' })}</label>
            <div
              className="grid grid-cols-3 gap-4"
              role="radiogroup"
              aria-label={t({ id: 'budget.form.type.aria' })}
            >
              {(['mensuel', 'annuel', 'ponctuel'] as const).map((budgetType) => (
                <button
                  key={budgetType}
                  type="button"
                  role="radio"
                  aria-checked={watchedType === budgetType}
                  onClick={() => handleTypeChange(budgetType)}
                  className={`h-12 rounded-xl border text-caption font-semibold transition-all
                      ${
                        watchedType === budgetType
                          ? 'bg-gold-subtle border-gold/20 text-gold'
                          : 'bg-surface border-separator text-label-tertiary hover:bg-raised'
                      }`}
                >
                  {t({ id: TYPE_LABEL_ID[budgetType] })}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className={LABEL_CLS}>{t({ id: 'budget.form.sens' })}</label>
            <div
              className="grid grid-cols-3 gap-4"
              role="radiogroup"
              aria-label={t({ id: 'budget.form.sens.aria' })}
            >
              {(['auto', 'entree', 'sortie'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={watchedSens === s}
                  onClick={() => setValue('sens', s, { shouldDirty: true, shouldValidate: true })}
                  className={`h-12 rounded-xl border text-caption font-semibold transition-all
                      ${
                        watchedSens === s
                          ? 'bg-gold-subtle border-gold/20 text-gold'
                          : 'bg-surface border-separator text-label-tertiary hover:bg-raised'
                      }`}
                >
                  {t({ id: SENS_LABEL_ID[s] })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <label htmlFor="bf-montant" className={LABEL_CLS}>
              {t({ id: 'budget.form.amount' })}
            </label>
            <div className="flex gap-4">
              <Controller
                name="montant"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    id="bf-montant"
                    min="0"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={!!errors.montant}
                    className={`${INPUT_CLS} font-serif font-bold text-base flex-1`}
                  />
                )}
              />
              <button
                type="button"
                className="h-11 px-6 rounded-xl bg-surface border border-separator text-gold text-caption font-semibold hover:bg-gold/10 transition-all flex items-center gap-2"
                onClick={handleSuggest}
                disabled={suggesting}
              >
                {suggesting ? (
                  <div className="w-3 h-3 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                ) : (
                  <Sparkles size={14} aria-hidden="true" />
                )}
                {t({ id: 'budget.form.suggest' })}
              </button>
            </div>
            {errors.montant && (
              <p role="alert" className={ERROR_CLS}>
                {errors.montant.message}
              </p>
            )}
          </div>

          {watchedType === 'annuel' && (
            <Controller
              control={control}
              name="moisAttendus"
              render={() => (
                <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-separator">
                  <label className={LABEL_CLS}>{t({ id: 'budget.form.months' })}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                      const isSelected = (watchedMoisAttendus || []).includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleMonth(m)}
                          className={`h-10 rounded-lg text-caption font-bold transition-all border
                              ${
                                isSelected
                                  ? 'bg-gold border-gold text-bg'
                                  : 'bg-bg border-separator text-label-tertiary hover:border-zinc-700'
                              }`}
                        >
                          {new Date(2026, m - 1)
                            .toLocaleDateString('fr-FR', { month: 'short' })
                            .replace('.', '')}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-caption text-label-tertiary leading-relaxed">
                    {t({ id: 'budget.form.months.hint' })}
                  </p>
                </div>
              )}
            />
          )}

          {watchedType === 'ponctuel' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label htmlFor="bf-debut" className={LABEL_CLS}>
                  {t({ id: 'budget.form.start' })}
                </label>
                <input
                  id="bf-debut"
                  type="date"
                  aria-invalid={!!errors.periode?.debut}
                  {...register('periode.debut')}
                  className={INPUT_CLS}
                />
                {errors.periode?.debut && (
                  <p role="alert" className={ERROR_CLS}>
                    {errors.periode.debut.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col">
                <label htmlFor="bf-fin" className={LABEL_CLS}>
                  {t({ id: 'budget.form.end' })}
                </label>
                <input
                  id="bf-fin"
                  type="date"
                  aria-invalid={!!errors.periode?.fin}
                  {...register('periode.fin')}
                  className={INPUT_CLS}
                />
                {errors.periode?.fin && (
                  <p role="alert" className={ERROR_CLS}>
                    {errors.periode.fin.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col">
            <label htmlFor="bf-compte" className={LABEL_CLS}>
              {t({ id: 'budget.form.account' })}
            </label>
            <Controller
              control={control}
              name="compte"
              render={({ field }) => (
                <select
                  id="bf-compte"
                  className={INPUT_CLS}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                >
                  <option value="" className="bg-bg">
                    {t({ id: 'budget.form.account.all' })}
                  </option>
                  {comptes.map((c) => (
                    <option key={c} value={c} className="bg-bg">
                      {c}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-8 border-t border-separator pb-2 mb-safe">
          <button
            type="button"
            className="flex-1 h-12 px-6 rounded-lg text-caption font-semibold bg-surface border border-separator text-label-tertiary hover:text-white transition-all cursor-pointer"
            onClick={onClose}
          >
            {t({ id: 'action.cancel' })}
          </button>
          <button
            type="submit"
            className="flex-2 h-12 px-6 rounded-lg text-caption font-semibold bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              t({ id: 'state.sync.short' })
            ) : (
              <>
                <Save size={14} aria-hidden="true" />{' '}
                {budget ? t({ id: 'budget.form.save.edit' }) : t({ id: 'budget.form.save.new' })}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
