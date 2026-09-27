import React, { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { useCredits } from '../hooks/useCredits';
import type { Credit } from '../types/banking.types';
import { creditFormSchema, type CreditFormValues } from '../lib/schemas/forms';
import { mensualite, dateFin } from '../utils/creditSchedule';
import { fmt } from '../utils/format';
import { MoneyInput } from './shared/MoneyInput';
import { Button, Field, IconButton, Input, Select, Sheet, Stack, Text } from '../ui';
import { confirm } from '../lib/confirm';

interface CreditFormModalProps {
  credit?: Credit;
  onClose: () => void;
  onSave: () => void;
}

const buildDefaults = (credit: Credit | undefined): CreditFormValues => ({
  nom: credit?.nom ?? '',
  owner: credit?.owner ?? 'Commun',
  capitalInitial: credit?.capitalInitial ?? 0,
  tauxAnnuel: credit?.tauxAnnuel ?? 0,
  dureeMois: credit?.dureeMois ?? 240,
  dateDebut: credit?.dateDebut ?? new Date().toISOString().split('T')[0]!,
  assuranceMensuelle: credit?.assuranceMensuelle ?? 0,
  commentaire: credit?.commentaire ?? '',
});

const formatDate = (date: Date): string => date.toLocaleDateString('fr-FR');

export const CreditFormModal: React.FC<CreditFormModalProps> = ({ credit, onClose, onSave }) => {
  const { formatMessage: t } = useIntl();
  const { addCredit, updateCredit, deleteCredit } = useCredits();
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreditFormValues>({
    resolver: zodResolver(creditFormSchema),
    defaultValues: buildDefaults(credit),
  });

  const watched = useWatch({ control });

  const onSubmit = async (values: CreditFormValues) => {
    try {
      if (credit?.id) {
        await updateCredit(credit.id, values);
      } else {
        await addCredit(values);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving credit:', err);
    }
  };

  const handleDelete = async () => {
    if (!credit?.id) return;
    if (
      !(await confirm({ message: t({ id: 'wealth.credits.form.delete.confirm' }), danger: true }))
    )
      return;
    setDeleting(true);
    try {
      await deleteCredit(credit.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error deleting credit:', err);
    } finally {
      setDeleting(false);
    }
  };

  const modalTitle = credit
    ? t({ id: 'wealth.credits.form.title.edit' })
    : t({ id: 'wealth.credits.form.title.new' });

  const previewCredit: Credit | null =
    watched.capitalInitial && watched.dureeMois && watched.dateDebut
      ? {
          id: 'preview',
          nom: watched.nom || '',
          owner: watched.owner,
          capitalInitial: Number(watched.capitalInitial) || 0,
          tauxAnnuel: Number(watched.tauxAnnuel) || 0,
          dureeMois: Number(watched.dureeMois) || 0,
          dateDebut: watched.dateDebut,
        }
      : null;

  return (
    <Sheet isOpen={true} onClose={onClose} title={modalTitle} variant="centered">
      <form
        id="credit-form"
        onSubmit={handleSubmit(onSubmit)}
        aria-label={modalTitle}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <Sheet.Body>
          <Stack gap="md">
            <Field label={t({ id: 'wealth.credits.form.name' })} error={errors.nom?.message}>
              {(p) => <Input {...p} type="text" {...register('nom')} />}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t({ id: 'wealth.credits.form.owner' })} error={errors.owner?.message}>
                {(p) => (
                  <Select {...p} {...register('owner')}>
                    <option value="Commun">Commun</option>
                    <option value="Nicolas">Nicolas</option>
                    <option value="Sienna">Sienna</option>
                    <option value="Romane">Romane</option>
                    <option value="Gwen">Gwen</option>
                  </Select>
                )}
              </Field>

              <Field
                label={t({ id: 'wealth.credits.form.startDate' })}
                error={errors.dateDebut?.message}
              >
                {(p) => <Input {...p} type="date" {...register('dateDebut')} />}
              </Field>

              <Field
                label={t({ id: 'wealth.credits.form.capital' })}
                error={errors.capitalInitial?.message}
              >
                {(p) => (
                  <Controller
                    name="capitalInitial"
                    control={control}
                    render={({ field }) => (
                      <MoneyInput
                        {...p}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        className="w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base text-label transition-colors focus:border-gold focus:outline-none"
                      />
                    )}
                  />
                )}
              </Field>

              <Field
                label={t({ id: 'wealth.credits.form.rate' })}
                error={errors.tauxAnnuel?.message}
              >
                {(p) => (
                  <Controller
                    name="tauxAnnuel"
                    control={control}
                    render={({ field }) => (
                      <MoneyInput
                        {...p}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        className="w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base text-label transition-colors focus:border-gold focus:outline-none"
                      />
                    )}
                  />
                )}
              </Field>

              <Field
                label={t({ id: 'wealth.credits.form.duration' })}
                error={errors.dureeMois?.message}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={1}
                    step={1}
                    {...register('dureeMois', { valueAsNumber: true })}
                  />
                )}
              </Field>

              <Field
                label={t({ id: 'wealth.credits.form.insurance' })}
                error={errors.assuranceMensuelle?.message}
              >
                {(p) => (
                  <Controller
                    name="assuranceMensuelle"
                    control={control}
                    render={({ field }) => (
                      <MoneyInput
                        {...p}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v ?? 0)}
                        onBlur={field.onBlur}
                        className="w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base text-label transition-colors focus:border-gold focus:outline-none"
                      />
                    )}
                  />
                )}
              </Field>
            </div>

            <Field label={t({ id: 'wealth.credits.form.comment' })}>
              {(p) => <Input {...p} type="text" {...register('commentaire')} />}
            </Field>

            {previewCredit && (
              <Stack gap="xs" className="rounded-md bg-raised p-4">
                <Text variant="footnote" tone="secondary">
                  {t(
                    { id: 'wealth.credits.form.computedPayment' },
                    { amount: fmt(mensualite(previewCredit)) },
                  )}
                </Text>
                <Text variant="footnote" tone="secondary">
                  {t(
                    { id: 'wealth.credits.form.computedEnd' },
                    { date: formatDate(dateFin(previewCredit)) },
                  )}
                </Text>
              </Stack>
            )}
          </Stack>
        </Sheet.Body>

        <Sheet.Footer>
          {credit?.id && (
            <IconButton
              label={deleting ? 'Suppression en cours' : t({ id: 'action.delete' })}
              onClick={handleDelete}
              disabled={isSubmitting || deleting}
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
            form="credit-form"
            variant="primary"
            loading={isSubmitting}
            disabled={deleting}
          >
            {!isSubmitting && <Save size={16} aria-hidden="true" />}
            {isSubmitting ? t({ id: 'state.saving' }) : t({ id: 'action.save' })}
          </Button>
        </Sheet.Footer>
      </form>
    </Sheet>
  );
};
