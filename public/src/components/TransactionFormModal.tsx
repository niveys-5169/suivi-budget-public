import React, { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { Transaction } from '../hooks/useTransactions';
import { Save, AlertCircle, Repeat, Trash2, Plus, Minus } from 'lucide-react';
import { createRecurrenceFromTransaction } from '../hooks/recurrencesService';
import { MoneyInput } from './shared/MoneyInput';
import { RecurrenceLinkField } from './shared/RecurrenceLinkField';
import { Button, Field, IconButton, Input, Select, Sheet, Stack, Switch, Text } from '../ui';
import { transactionFormSchema, type TransactionFormValues } from '../lib/schemas/forms';
import { useFirestoreErrorHandler } from '../hooks/useFirestoreErrorHandler';
import { confirm } from '../lib/confirm';

type TransactionFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Partial<Transaction> & { id?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void> | void;
  transaction?: Transaction | null;
  categories: string[];
  accounts: string[];
};

const todayISO = () => new Date().toISOString().split('T')[0]!;

const buildDefaults = (
  transaction: Transaction | null | undefined,
  accounts: string[],
): TransactionFormValues => ({
  date: transaction?.date?.split('T')[0] ?? todayISO(),
  libelle: transaction?.libelle ?? '',
  montant: transaction?.montant ?? 0,
  compte: transaction?.compte ?? accounts[0] ?? '',
  categorie: transaction?.categorie ?? '',
  commentaire: transaction?.commentaire ?? '',
  pointe: transaction?.pointe ?? false,
  moisAffectation: transaction?.moisAffectation ?? '',
});

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  transaction,
  categories,
  accounts,
}) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: buildDefaults(transaction, accounts),
  });

  const { formatMessage: t } = useIntl();
  const { handle: handleFsError } = useFirestoreErrorHandler();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isMarkingRecurring, setIsMarkingRecurring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!transaction?.id || !onDelete) return;
    const confirmMsg = `Supprimer la transaction « ${transaction.libelle} » du ${transaction.date} ?`;
    if (!(await confirm({ message: confirmMsg, danger: true }))) return;
    setIsDeleting(true);
    setSubmitError(null);
    try {
      await onDelete(transaction.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la suppression.';
      setSubmitError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Erreur effacée à chaque ouverture ou changement de transaction.
  const errorKey = isOpen ? (transaction ?? 'new') : null;
  const [seenErrorKey, setSeenErrorKey] = useState(errorKey);
  if (errorKey !== seenErrorKey) {
    setSeenErrorKey(errorKey);
    if (isOpen) setSubmitError(null);
  }

  // Le formulaire (store react-hook-form, externe à React) suit les props.
  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(transaction, accounts));
    }
  }, [transaction, isOpen, accounts, reset]);

  const handleMarkAsRecurring = async () => {
    const values = getValues();
    if (!values.categorie || !values.montant) {
      setSubmitError(t({ id: 'tx.recurring.error' }));
      return;
    }
    setIsMarkingRecurring(true);
    try {
      const txToRecur: Transaction = {
        id: transaction?.id || 'temp',
        libelle: values.libelle,
        categorie: values.categorie,
        montant: Number(values.montant),
        date: values.date,
        compte: values.compte,
        pointe: values.pointe,
      };

      await createRecurrenceFromTransaction(txToRecur);

      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            type: 'success',
            message: t({ id: 'tx.recurring.success' }),
            duration: 3000,
          },
        }),
      );
    } catch (err) {
      const handled = handleFsError(err, { context: 'transaction.markRecurring' });
      setSubmitError(handled.message);
    } finally {
      setIsMarkingRecurring(false);
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);
    try {
      const dataToSave: Partial<Transaction> & { id?: string } = { ...values };
      if (transaction?.id) dataToSave.id = transaction.id;
      if (!values.categorie) delete dataToSave.categorie;
      if (!values.commentaire) delete dataToSave.commentaire;
      if (!values.moisAffectation) delete dataToSave.moisAffectation;

      await onSave(dataToSave);
      onClose();
    } catch (err: unknown) {
      console.error('Error saving transaction:', err);
      const msg =
        err instanceof Error ? err.message : "Échec de l'enregistrement. Vérifiez votre connexion.";
      setSubmitError(msg);
    }
  };

  const modalTitle = transaction ? t({ id: 'tx.form.title.edit' }) : t({ id: 'tx.form.title.new' });
  const watchedMontant = useWatch({ control, name: 'montant' });
  const watchedCategorie = useWatch({ control, name: 'categorie' });
  const watchedPointe = useWatch({ control, name: 'pointe' });

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      subtitle={t({ id: 'tx.form.subtitle' })}
    >
      <form
        id="transaction-form"
        onSubmit={handleSubmit(onSubmit)}
        aria-label={modalTitle}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <Sheet.Body>
          <Stack gap="md">
            {submitError && (
              <Stack
                direction="row"
                gap="sm"
                align="center"
                role="alert"
                className="rounded-md bg-negative-subtle p-4"
              >
                <AlertCircle size={16} aria-hidden="true" className="shrink-0 text-negative" />
                <Text variant="footnote" tone="negative">
                  {submitError}
                </Text>
              </Stack>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t({ id: 'tx.form.date' })} error={errors.date?.message}>
                {(p) => <Input {...p} type="date" {...register('date')} />}
              </Field>

              <Field label={t({ id: 'tx.form.account' })} error={errors.compte?.message}>
                {(p) => (
                  <Select {...p} {...register('compte')}>
                    <option value="" disabled>
                      {t({ id: 'tx.form.account.placeholder' })}
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc} value={acc}>
                        {acc}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t({ id: 'tx.form.label' })}
                error={errors.libelle?.message}
                className="sm:col-span-2"
              >
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    {...register('libelle')}
                    placeholder={t({ id: 'tx.form.label.placeholder' })}
                  />
                )}
              </Field>

              <Field label={t({ id: 'tx.form.amount' })} error={errors.montant?.message}>
                {(p) => (
                  <Controller
                    name="montant"
                    control={control}
                    render={({ field }) => (
                      <Stack direction="row" gap="sm" align="center">
                        <IconButton
                          type="button"
                          label={t({ id: 'tx.form.amount.toggleSign' })}
                          onClick={() => field.onChange(-(Number(field.value) || 0))}
                          className={Number(field.value) >= 0 ? 'text-positive' : 'text-negative'}
                        >
                          {Number(field.value) >= 0 ? (
                            <Plus size={18} aria-hidden="true" />
                          ) : (
                            <Minus size={18} aria-hidden="true" />
                          )}
                        </IconButton>
                        <MoneyInput
                          {...p}
                          value={field.value ?? null}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder={t({ id: 'tx.form.amount.placeholder' })}
                          /* L'or est réservé aux accents : un montant s'exprime
                             en vert ou en rouge (DESIGN_SYSTEM.md § Couleurs). */
                          className={`w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base font-semibold [font-variant-numeric:tabular-nums] transition-colors focus:border-gold focus:outline-none ${
                            Number(watchedMontant) >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        />
                      </Stack>
                    )}
                  />
                )}
              </Field>

              <Field label={t({ id: 'tx.form.category' })}>
                {(p) => (
                  <Select {...p} {...register('categorie')}>
                    <option value="">{t({ id: 'tx.form.category.none' })}</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label={t({ id: 'tx.form.month' })}>
                {(p) => <Input {...p} type="month" {...register('moisAffectation')} />}
              </Field>

              <Stack gap="sm" justify="center">
                <Text variant="footnote" tone="secondary">
                  {t({ id: 'tx.form.certified' })}
                </Text>
                <Stack direction="row" gap="md" align="center">
                  <Controller
                    name="pointe"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={!!field.value}
                        onChange={field.onChange}
                        label={t({ id: 'tx.form.certified' })}
                      />
                    )}
                  />
                  <Text variant="subhead" tone={watchedPointe ? 'accent' : 'tertiary'}>
                    {watchedPointe
                      ? t({ id: 'tx.status.certified' })
                      : t({ id: 'tx.status.toReview' })}
                  </Text>
                </Stack>
              </Stack>

              <Field label={t({ id: 'tx.form.memo' })} className="sm:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    {...register('commentaire')}
                    placeholder={t({ id: 'tx.form.memo.placeholder' })}
                  />
                )}
              </Field>

              {transaction?.id && (
                <div className="sm:col-span-2">
                  <RecurrenceLinkField transaction={transaction} />
                </div>
              )}

              <div className="sm:col-span-2">
                <Button
                  variant="secondary"
                  block
                  onClick={handleMarkAsRecurring}
                  disabled={isMarkingRecurring || !watchedCategorie || !watchedMontant}
                >
                  <Repeat size={16} aria-hidden="true" />
                  {isMarkingRecurring
                    ? t({ id: 'tx.form.recurring.loading' })
                    : t({ id: 'tx.form.recurring' })}
                </Button>
              </div>
            </div>
          </Stack>
        </Sheet.Body>

        <Sheet.Footer>
          {transaction?.id && onDelete && (
            <IconButton
              label={isDeleting ? 'Suppression en cours' : 'Supprimer la transaction'}
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              className="mr-auto text-negative"
            >
              <Trash2 size={18} aria-hidden="true" />
            </IconButton>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t({ id: 'action.cancel' })}
          </Button>
          <Button
            as="button"
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isDeleting}
          >
            {!isSubmitting && <Save size={16} aria-hidden="true" />}
            {isSubmitting
              ? t({ id: 'state.saving' })
              : transaction
                ? t({ id: 'tx.form.save.edit' })
                : t({ id: 'tx.form.save.new' })}
          </Button>
        </Sheet.Footer>
      </form>
    </Sheet>
  );
};
