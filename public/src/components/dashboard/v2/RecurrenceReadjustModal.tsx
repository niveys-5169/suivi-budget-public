import React, { useState } from 'react';
import { Modal } from '../../shared/Modal';
import { Input, Switch } from '../../../ui';
import { MoneyInput } from '../../shared/MoneyInput';
import type { BudgetBase, Recurrence } from '../../../types/banking.types';
import { computeBudgetAdjustment } from '../../../utils/recurrenceBudget';
import { formatCurrency } from '../../../lib/formatters';

interface RecurrenceReadjustModalProps {
  recurrence: Recurrence | null;
  /** Mois proposé par défaut pour l'entrée en vigueur (YYYY-MM). */
  defaultMonth: string;
  budgets: BudgetBase[];
  onClose: () => void;
  onConfirm: (
    recurrence: Recurrence,
    fromPeriod: string,
    newAmount: number,
    adjustBudget: boolean,
  ) => Promise<void>;
}

const INPUT_CLS =
  'h-11 rounded-xl border border-separator bg-raised text-sm px-4 text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all w-full';
const LABEL_CLS = 'text-caption font-semibold text-label-tertiary mb-2 ml-1 block';

/**
 * Réajuste le montant d'une récurrence (ex. hausse d'assurance) à partir d'un
 * mois : les mois précédents gardent l'ancien montant. Propose de répercuter
 * l'écart sur le budget de la catégorie.
 */
export const RecurrenceReadjustModal: React.FC<RecurrenceReadjustModalProps> = ({
  recurrence,
  defaultMonth,
  budgets,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState<number | null>(null);
  const [fromPeriod, setFromPeriod] = useState(defaultMonth);
  const [adjustBudget, setAdjustBudget] = useState(true);
  const [saving, setSaving] = useState(false);

  // Champs réinitialisés depuis chaque nouvelle récurrence réajustée.
  const [loaded, setLoaded] = useState<Recurrence | null>(null);
  if (recurrence && recurrence !== loaded) {
    setLoaded(recurrence);
    setAmount(Math.abs(recurrence.expectedAmount));
    setFromPeriod(defaultMonth);
    setAdjustBudget(true);
  }

  if (!recurrence) return null;

  const current = Math.abs(recurrence.expectedAmount);
  const isExpense = recurrence.expectedAmount < 0;
  const changed = amount !== null && amount > 0 && amount !== current;
  const adjustment =
    isExpense && changed
      ? computeBudgetAdjustment(budgets, recurrence.category, current, amount)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed || !fromPeriod) return;
    setSaving(true);
    try {
      await onConfirm(recurrence, fromPeriod, amount, adjustBudget && adjustment !== null);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Réajuster le montant" size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-caption text-label-tertiary">
          <span className="font-semibold text-white">{recurrence.label}</span> — actuellement{' '}
          {formatCurrency(current)} par mois.
        </p>

        <div>
          <label htmlFor="readjust-amount" className={LABEL_CLS}>
            Nouveau montant
          </label>
          <MoneyInput
            id="readjust-amount"
            className={INPUT_CLS}
            value={amount}
            onChange={setAmount}
          />
        </div>

        <div>
          <label htmlFor="readjust-from" className={LABEL_CLS}>
            Applicable à partir de
          </label>
          <Input
            id="readjust-from"
            type="month"
            value={fromPeriod}
            onChange={(e) => setFromPeriod(e.target.value)}
            required
          />
          <p className="text-caption text-label-tertiary mt-2 ml-1">
            Les mois précédents conservent l&apos;ancien montant.
          </p>
        </div>

        {adjustment && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gold/5 border border-gold/10">
            <Switch
              checked={adjustBudget}
              onChange={setAdjustBudget}
              label="Ajuster aussi le budget de la catégorie"
            />
            <span className="text-caption text-label">
              Ajuster aussi le budget « {adjustment.budget.nom || adjustment.budget.categorie} » :{' '}
              {formatCurrency(Number(adjustment.budget.montant) || 0)} →{' '}
              {formatCurrency(adjustment.montant)}
              {adjustment.budget.type === 'annuel' ? ' par an' : ' par mois'}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !changed || !fromPeriod}
          className="w-full h-11 rounded-xl text-caption font-semibold bg-gold text-bg hover:bg-gold-light disabled:opacity-50 transition-all shadow-lg shadow-gold/20"
        >
          {saving ? 'Enregistrement…' : 'Réajuster'}
        </button>
      </form>
    </Modal>
  );
};
