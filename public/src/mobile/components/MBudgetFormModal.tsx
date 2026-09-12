import React, { useState } from 'react';
import { createBudget, updateBudget } from '../../api/budgets';
import { buildBudgetDefaults, buildBudgetPayload, periodeTypeFor } from '../../lib/budgetForm';
import { budgetFormSchema } from '../../lib/schemas/forms';
import { Save } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { CategoryIcon } from '../../components/CategoryIcon';
import { MoneyInput } from '../../components/shared/MoneyInput';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import type { BudgetBase } from '../../types/banking.types';

interface MBudgetFormModalProps {
  categoryName: string;
  currentBudget?: BudgetBase;
  onClose: () => void;
  onSave: () => void;
}

export const MBudgetFormModal: React.FC<MBudgetFormModalProps> = ({
  categoryName,
  currentBudget,
  onClose,
  onSave,
}) => {
  const defaults = buildBudgetDefaults(currentBudget);
  const [montant, setMontant] = useState<number | null>(currentBudget ? defaults.montant : null);
  const [type, setType] = useState<'mensuel' | 'annuel' | 'ponctuel'>(defaults.type);
  const [sens, setSens] = useState<'auto' | 'entree' | 'sortie'>(defaults.sens);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = getCategoryMeta(categoryName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Mêmes valeurs, même validation et même payload que le formulaire desktop :
    // seuls type/montant/sens sont édités ici, le reste vient du budget existant
    // (plus d'écrasement de moisAttendus/compte/periode saisis sur desktop).
    const values = {
      ...defaults,
      nom: categoryName,
      categorie: categoryName,
      actif: true,
      type,
      montant: montant ?? 0,
      sens,
      periode: { ...defaults.periode, type: periodeTypeFor(type) },
    };
    const parsed = budgetFormSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = buildBudgetPayload(parsed.data);
      if (currentBudget?.id) {
        await updateBudget(currentBudget.id, payload);
      } else {
        await createBudget(payload);
      }
      onSave();
    } catch (err) {
      console.error('Budget save error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={categoryName}
      subtitle={currentBudget ? 'Modifier le budget' : 'Créer un budget'}
      variant="sheet"
      size="sm"
      headerActions={
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
        >
          <CategoryIcon icon={meta.icon} size={16} />
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="p-4 rounded-lg bg-negative/10 border border-negative/20 text-negative text-footnote font-bold">
            {error}
          </div>
        )}

        {/* Type Selection */}
        <fieldset className="space-y-2">
          <legend className="text-caption font-bold text-label-tertiary">Type de budget</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['mensuel', 'annuel', 'ponctuel'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 px-2 rounded-lg text-caption font-bold transition-colors text-center text-xs ${
                  type === t
                    ? 'bg-gold text-bg'
                    : 'bg-white/5 border border-separator text-label-tertiary hover:bg-white/10'
                }`}
              >
                {t === 'mensuel' ? 'Mois' : t === 'annuel' ? 'Année' : 'Ponctuel'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Sens du flux */}
        <fieldset className="space-y-2">
          <legend className="text-caption font-bold text-label-tertiary">Sens du flux</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'entree', 'sortie'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSens(s)}
                className={`py-2 px-2 rounded-lg text-caption font-bold transition-colors text-center text-xs ${
                  sens === s
                    ? 'bg-gold text-bg'
                    : 'bg-white/5 border border-separator text-label-tertiary hover:bg-white/10'
                }`}
              >
                {s === 'auto' ? 'Auto' : s === 'entree' ? 'Entrée' : 'Sortie'}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Amount Input */}
        <div className="space-y-2">
          <label htmlFor="montant" className="text-caption font-bold text-label-tertiary">
            Montant {type === 'annuel' ? '(annuel)' : '(mensuel)'}
          </label>
          <MoneyInput
            id="montant"
            min="0"
            value={montant}
            onChange={setMontant}
            className="w-full px-4 py-2 bg-white/5 border border-separator rounded-lg text-white text-base font-bold focus:outline-none focus:border-gold/50 transition-colors"
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 -mx-4 flex gap-2 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] border-t border-separator bg-bg/95 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-white/5 border border-separator text-white text-caption font-bold hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 rounded-lg bg-gold text-bg text-caption font-bold hover:bg-gold-light disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-bg/20 border-t-ink rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isSubmitting ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
