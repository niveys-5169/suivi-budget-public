import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

export type BulkDialogMode = 'rename' | 'categorize' | 'month' | 'delete';

interface BulkActionDialogProps {
  mode: BulkDialogMode | null;
  count: number;
  categories: string[];
  onClose: () => void;
  /** Renvoie la valeur saisie (libellé, catégorie, mois) ou `undefined` pour la suppression. */
  onConfirm: (mode: BulkDialogMode, value?: string) => Promise<void>;
}

const INPUT_CLS =
  'h-11 rounded-control border border-separator bg-raised text-sm px-4 text-white focus:outline-none focus:ring-2 focus:ring-gold/40';
const LABEL_CLS = 'text-caption font-semibold text-label-tertiary mb-2';

/** Modale unique pour les opérations groupées : renommer, catégoriser, attribuer un mois, supprimer. */
export const BulkActionDialog: React.FC<BulkActionDialogProps> = ({
  mode,
  count,
  categories,
  onClose,
  onConfirm,
}) => {
  const { formatMessage: t } = useIntl();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  // Réinitialise le champ à chaque ouverture / changement de mode.
  useEffect(() => {
    setValue('');
  }, [mode]);

  if (!mode) return null;

  const titleKey =
    mode === 'rename'
      ? 'tx.bulk.dialog.rename.title'
      : mode === 'categorize'
        ? 'tx.bulk.dialog.categorize.title'
        : mode === 'month'
          ? 'tx.bulk.dialog.month.title'
          : 'tx.bulk.dialog.delete.title';

  const canConfirm = mode === 'delete' || (mode === 'categorize' ? true : value.trim().length > 0);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm(mode, mode === 'delete' ? undefined : value);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t({ id: titleKey })}
      subtitle={t({ id: 'tx.bulk.selected' }, { count })}
      size="sm"
      variant="centered"
      fullHeight={false}
    >
      <div className="p-6 space-y-6">
        {mode === 'rename' && (
          <div className="flex flex-col">
            <label htmlFor="bulk-rename" className={LABEL_CLS}>
              {t({ id: 'tx.form.label' })}
            </label>
            <input
              id="bulk-rename"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t({ id: 'tx.bulk.dialog.rename.placeholder' })}
              className={INPUT_CLS}
            />
          </div>
        )}

        {mode === 'categorize' && (
          <div className="flex flex-col">
            <label htmlFor="bulk-categorize" className={LABEL_CLS}>
              {t({ id: 'tx.form.category' })}
            </label>
            <select
              id="bulk-categorize"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={INPUT_CLS}
            >
              <option value="" className="bg-bg">
                {t({ id: 'tx.form.category.none' })}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-bg">
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'month' && (
          <div className="flex flex-col">
            <label htmlFor="bulk-month" className={LABEL_CLS}>
              {t({ id: 'tx.form.month' })}
            </label>
            <input
              id="bulk-month"
              type="month"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        )}

        {mode === 'delete' && (
          <p className="text-sm text-label-secondary leading-relaxed">
            {t({ id: 'tx.bulk.dialog.delete.confirm' }, { count })}
          </p>
        )}

        <div className="flex justify-end gap-4 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t({ id: 'tx.bulk.cancel' })}
          </Button>
          <Button
            variant={mode === 'delete' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={busy}
            disabled={!canConfirm}
          >
            {mode === 'delete' ? t({ id: 'tx.bulk.delete' }) : t({ id: 'tx.bulk.apply' })}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
