import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../ui';
import { Modal } from '../../shared/Modal';
import { MoneyInput } from '../../shared/MoneyInput';
import type { Recurrence } from '../../../types/banking.types';
import { getDayOfMonth } from '../../../utils/recurrenceEngine';

interface RecurrenceEditModalProps {
  recurrence: Recurrence | null;
  categories: string[];
  onClose: () => void;
  onSave: (
    id: string,
    patch: {
      label: string;
      category: string;
      expectedAmount: number;
      anchorDate: string;
    },
  ) => Promise<void>;
  /** Supprime la récurrence courante. La confirmation est gérée par l'appelant. */
  onDelete: () => void;
}

const INPUT_CLS =
  'h-11 rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all w-full';
const LABEL_CLS = 'text-caption font-semibold text-label-tertiary mb-2 ml-1 block';

const defaultAnchorDate = (r: Recurrence): string => {
  if (r.anchorDate) return r.anchorDate.split('T')[0] ?? '';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const maxDay = new Date(year, month, 0).getDate();
  const day = Math.min(getDayOfMonth(r), maxDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Modale d'édition d'une récurrence : libellé, catégorie, montant, date de référence (jour de prélèvement mensuel). */
export const RecurrenceEditModal: React.FC<RecurrenceEditModalProps> = ({
  recurrence,
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [anchorDate, setAnchorDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Champs réinitialisés depuis chaque nouvelle récurrence éditée.
  const [loadedRecurrence, setLoadedRecurrence] = useState<Recurrence | null>(null);
  if (recurrence && recurrence !== loadedRecurrence) {
    setLoadedRecurrence(recurrence);
    setLabel(recurrence.label);
    setCategory(recurrence.category);
    setAmount(Math.abs(recurrence.expectedAmount));
    setAnchorDate(defaultAnchorDate(recurrence));
  }

  if (!recurrence) return null;

  const isNegative = recurrence.expectedAmount < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !category.trim() || amount === null || !anchorDate) return;
    setSaving(true);
    try {
      await onSave(recurrence.id, {
        label: label.trim(),
        category: category.trim(),
        expectedAmount: isNegative ? -Math.abs(amount) : Math.abs(amount),
        anchorDate,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!recurrence} onClose={onClose} title="Modifier la récurrence" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="rec-label" className={LABEL_CLS}>
            Libellé
          </label>
          <input
            id="rec-label"
            className={INPUT_CLS}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="rec-category" className={LABEL_CLS}>
            Catégorie
          </label>
          <select
            id="rec-category"
            className={INPUT_CLS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value={category}>{category}</option>
            {categories
              .filter((c) => c !== category)
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label htmlFor="rec-amount" className={LABEL_CLS}>
            Montant attendu
          </label>
          <MoneyInput id="rec-amount" className={INPUT_CLS} value={amount} onChange={setAmount} />
        </div>

        <div>
          <label htmlFor="rec-anchor" className={LABEL_CLS}>
            Date de référence
          </label>
          <input
            id="rec-anchor"
            type="date"
            className={INPUT_CLS}
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 rounded-xl text-caption font-semibold bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all shadow-lg shadow-gold/20"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

        <Button type="button" variant="destructive" block onClick={onDelete} disabled={saving}>
          <Trash2 size={14} />
          Supprimer cette récurrence
        </Button>
      </form>
    </Modal>
  );
};
