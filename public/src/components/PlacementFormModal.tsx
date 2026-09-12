import React, { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useIntl } from 'react-intl';
import { usePlacements, type Placement, type LegacyPlacementFields } from '../hooks/usePlacements';
import type { PlacementSnapshot } from '../types/patrimoine';
import { placementFormSchema, type PlacementFormValues } from '../lib/schemas/forms';
import { Modal } from './shared/Modal';
import { MoneyInput } from './shared/MoneyInput';
import { confirm } from '../lib/confirm';

interface PlacementFormModalProps {
  placement?: Placement & Partial<LegacyPlacementFields>;
  previousAmount?: PlacementSnapshot | null;
  onClose: () => void;
  onSave: () => void;
}

const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const normalizeType = (raw: unknown): PlacementFormValues['type'] => {
  const t = String(raw || '').toLowerCase();
  if (['cash', 'savings', 'market', 'retirement', 'other'].includes(t))
    return t as PlacementFormValues['type'];
  if (t === 'epargne') return 'savings';
  if (['cto', 'pea', 'assurance_vie', 'portefeuille'].includes(t)) return 'market';
  if (t === 'per') return 'retirement';
  return 'savings';
};

const FIELD_CLS =
  'w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors';
const ERROR_CLS = 'text-caption font-bold text-negative mt-1';

export const PlacementFormModal: React.FC<PlacementFormModalProps> = ({
  placement,
  previousAmount,
  onClose,
  onSave,
}) => {
  const { formatMessage: t } = useIntl();
  const { addPlacement, updatePlacement, deletePlacement } = usePlacements();
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlacementFormValues>({
    resolver: zodResolver(placementFormSchema),
    defaultValues: {
      nom: placement?.nom || placement?.name || '',
      owner: placement?.owner || placement?.ownerId || 'Nicolas',
      type: normalizeType(placement?.type),
      montant: placement?.montant || placement?.balance || 0,
      compte: placement?.compte || placement?.account || '',
    },
  });

  const isLive = placement?.id?.startsWith('live_pf_') || placement?.id?.startsWith('portfolio');

  const onSubmit = async (values: PlacementFormValues) => {
    try {
      if (
        placement?.id &&
        !placement.id.startsWith('live_pf_') &&
        !placement.id.startsWith('portfolio')
      ) {
        await updatePlacement(placement.id, values);
      } else {
        await addPlacement(values);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving placement:', err);
    }
  };

  const handleDelete = async () => {
    if (!placement?.id) return;
    if (!(await confirm({ message: t({ id: 'placement.form.delete.confirm' }), danger: true })))
      return;
    setDeleting(true);
    try {
      await deletePlacement(placement.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Error deleting placement:', err);
    } finally {
      setDeleting(false);
    }
  };

  const busy = isSubmitting || deleting;

  const headerActions = (
    <button
      type="submit"
      form="placement-form"
      disabled={busy || isLive}
      className="h-11 px-6 rounded-xl text-caption font-semibold bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
    >
      {isSubmitting ? (
        t({ id: 'state.saving' })
      ) : (
        <>
          <Save size={14} aria-hidden="true" />
          {t({ id: 'action.save' })}
        </>
      )}
    </button>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        placement ? t({ id: 'placement.form.title.edit' }) : t({ id: 'placement.form.title.new' })
      }
      headerActions={headerActions}
      variant="centered"
    >
      <form
        id="placement-form"
        onSubmit={handleSubmit(onSubmit)}
        className="p-8 space-y-6"
        noValidate
      >
        {isLive && (
          <div className="p-4 rounded-xl bg-gold/10 border border-gold/20 text-caption font-bold text-gold text-center">
            {t({ id: 'placement.form.live.warning' })}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="pf-nom" className="text-caption font-semibold text-label/40">
            {t({ id: 'placement.form.name' })}
          </label>
          <input
            id="pf-nom"
            type="text"
            disabled={isLive}
            aria-invalid={!!errors.nom}
            aria-describedby={errors.nom ? 'pf-nom-err' : undefined}
            {...register('nom')}
            className={FIELD_CLS}
          />
          {errors.nom && (
            <p id="pf-nom-err" role="alert" className={ERROR_CLS}>
              {errors.nom.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="pf-owner" className="text-caption font-semibold text-label/40">
              {t({ id: 'placement.form.owner' })}
            </label>
            <select
              id="pf-owner"
              disabled={isLive}
              aria-invalid={!!errors.owner}
              {...register('owner')}
              className={`${FIELD_CLS} appearance-none`}
            >
              <option value="Nicolas">Nicolas</option>
              <option value="Sienna">Sienna</option>
              <option value="Romane">Romane</option>
              <option value="Gwen">Gwen</option>
            </select>
            {errors.owner && (
              <p role="alert" className={ERROR_CLS}>
                {errors.owner.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor="pf-type" className="text-caption font-semibold text-label/40">
              {t({ id: 'placement.form.type' })}
            </label>
            <select
              id="pf-type"
              disabled={isLive}
              aria-invalid={!!errors.type}
              {...register('type')}
              className={`${FIELD_CLS} appearance-none`}
            >
              <option value="cash">{t({ id: 'placement.form.type.cash' })}</option>
              <option value="savings">{t({ id: 'placement.form.type.savings' })}</option>
              <option value="market">{t({ id: 'placement.form.type.market' })}</option>
              <option value="retirement">{t({ id: 'placement.form.type.retirement' })}</option>
              <option value="other">{t({ id: 'placement.form.type.other' })}</option>
            </select>
            {errors.type && (
              <p role="alert" className={ERROR_CLS}>
                {errors.type.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="pf-montant" className="text-caption font-semibold text-label/40">
            {t({ id: 'placement.form.amount' })}
          </label>
          <Controller
            name="montant"
            control={control}
            render={({ field }) => (
              <MoneyInput
                id="pf-montant"
                value={field.value ?? null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={isLive}
                aria-invalid={!!errors.montant}
                aria-describedby={errors.montant ? 'pf-montant-err' : undefined}
                className={FIELD_CLS}
              />
            )}
          />
          {errors.montant && (
            <p id="pf-montant-err" role="alert" className={ERROR_CLS}>
              {errors.montant.message}
            </p>
          )}
          {!isLive && previousAmount && (
            <p className="text-caption text-label/40">
              Snapshot du {formatDate(previousAmount.date)} :{' '}
              {previousAmount.montant.toLocaleString('fr-FR')} €
            </p>
          )}
        </div>

        <div className="pt-4 flex gap-4">
          {placement && !isLive && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-negative/20 text-negative hover:bg-negative/10 transition-all flex items-center justify-center disabled:opacity-50"
              aria-label={t({ id: 'action.delete' })}
            >
              <Trash2 size={18} />
              <span className="ml-2 text-caption font-semibold">{t({ id: 'action.delete' })}</span>
            </button>
          )}
          <button
            type="button"
            className="flex-1 h-12 rounded-xl bg-surface border border-separator text-label-tertiary hover:text-white transition-all text-caption font-semibold"
            onClick={onClose}
          >
            {t({ id: 'action.cancel' })}
          </button>
        </div>
      </form>
    </Modal>
  );
};
