import React from 'react';
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
} from 'react-hook-form';
import { useIntl } from 'react-intl';
import { Plus, Trash2 } from 'lucide-react';
import { MoneyInput } from '../shared/MoneyInput';
import { Button, Field, IconButton, Input, Select, Stack, Text } from '../../ui';
import { formatCurrency } from '../../lib/formatters';
import type { TransactionFormValues } from '../../lib/schemas/forms';

interface VentilationFieldProps {
  control: Control<TransactionFormValues>;
  errors: FieldErrors<TransactionFormValues>;
  categories: string[];
}

/**
 * Parts ventilées d'une transaction, saisies en valeur absolue. Le reste du
 * montant garde la catégorie et le mois d'affectation choisis plus haut.
 */
export const VentilationField: React.FC<VentilationFieldProps> = ({
  control,
  errors,
  categories,
}) => {
  const { formatMessage: t } = useIntl();
  const { fields, append, remove } = useFieldArray({ control, name: 'ventilation' });
  const [montant, categorie, parts] = useWatch({
    control,
    name: ['montant', 'categorie', 'ventilation'],
  });
  const ventile = (parts ?? []).reduce((sum, p) => sum + (Number(p?.montant) || 0), 0);
  const remainder = Math.abs(Number(montant) || 0) - ventile;

  return (
    <Stack gap="sm">
      <Text variant="subhead">{t({ id: 'tx.form.ventilation' })}</Text>

      {fields.map((item, i) => (
        <Stack key={item.id} direction="row" gap="sm" align="end">
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <Field
              label={t({ id: 'tx.form.ventilation.amount' })}
              error={errors.ventilation?.[i]?.montant?.message}
            >
              {(p) => (
                <Controller
                  name={`ventilation.${i}.montant`}
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      {...p}
                      value={field.value ?? null}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      className="w-full min-h-11 rounded-md border border-transparent bg-raised px-4 text-base [font-variant-numeric:tabular-nums] focus:border-gold focus:outline-none"
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label={t({ id: 'tx.form.category' })}
              error={errors.ventilation?.[i]?.categorie?.message}
            >
              {(p) => (
                <Controller
                  name={`ventilation.${i}.categorie`}
                  control={control}
                  render={({ field }) => (
                    <Select {...p} {...field}>
                      <option value="">{t({ id: 'tx.form.category.none' })}</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              )}
            </Field>
            <Field label={t({ id: 'tx.form.month' })}>
              {(p) => (
                <Controller
                  name={`ventilation.${i}.moisAffectation`}
                  control={control}
                  render={({ field }) => <Input {...p} type="month" {...field} />}
                />
              )}
            </Field>
          </div>
          <IconButton
            label={t({ id: 'tx.form.ventilation.remove' })}
            onClick={() => remove(i)}
            className="text-negative"
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </Stack>
      ))}

      {fields.length > 0 && (
        <Text
          variant="footnote"
          tone={remainder < 0 ? 'negative' : 'secondary'}
          role={errors.ventilation?.message ? 'alert' : undefined}
        >
          {errors.ventilation?.message ??
            t(
              { id: 'tx.form.ventilation.remainder' },
              {
                amount: formatCurrency(remainder),
                category: categorie || t({ id: 'tx.form.category.none' }),
              },
            )}
        </Text>
      )}

      <Button
        variant="secondary"
        block
        onClick={() => append({ montant: null, categorie: '', moisAffectation: '' })}
      >
        <Plus size={16} aria-hidden="true" />
        {t({ id: 'tx.form.ventilation.add' })}
      </Button>
    </Stack>
  );
};
