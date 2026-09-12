import React, { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { usePlacements } from '../../hooks/usePlacements';
import { MoneyInput } from '../../components/shared/MoneyInput';
import { confirm } from '../../lib/confirm';

interface MPlacementFormModalProps {
  placement?: {
    id: string;
    nom: string;
    type: string;
    montant: number;
    owner?: string;
  };
  onClose: () => void;
  onSave: () => void;
}

const PLACEMENT_TYPES = [
  { value: 'cash', label: 'Liquidités' },
  { value: 'savings', label: 'Épargne' },
  { value: 'market', label: 'Investissements' },
  { value: 'retirement', label: 'Retraite' },
  { value: 'other', label: 'Autres' },
];

export const MPlacementFormModal: React.FC<MPlacementFormModalProps> = ({
  placement,
  onClose,
  onSave,
}) => {
  const { addPlacement, updatePlacement, deletePlacement } = usePlacements();
  const [nom, setNom] = useState(placement?.nom ?? '');
  const [type, setType] = useState<string>(placement?.type ?? 'savings');
  const [montant, setMontant] = useState<number | null>(placement?.montant ?? null);
  const [owner, setOwner] = useState(placement?.owner ?? 'Nicolas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLive = placement?.id?.startsWith('live_pf_') || placement?.id?.startsWith('portfolio');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!nom.trim()) {
        setError('Le nom du placement est requis');
        setIsSubmitting(false);
        return;
      }

      if (placement?.id && !isLive) {
        await updatePlacement(placement.id, { nom, type, montant: montant ?? 0, owner });
      } else {
        await addPlacement({ nom, type, montant: montant ?? 0, owner });
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Placement save error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!placement?.id) return;
    if (
      !(await confirm({
        message: 'Êtes-vous sûr de vouloir supprimer ce placement ?',
        danger: true,
      }))
    )
      return;

    setIsDeleting(true);
    try {
      await deletePlacement(placement.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Placement delete error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={placement ? 'Modifier le placement' : 'Nouveau placement'}
      subtitle={isLive ? 'Lecture seule (provenance externe)' : undefined}
      variant="sheet"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        {error && (
          <div className="p-4 rounded-lg bg-negative/10 border border-negative/20 text-negative text-footnote font-bold">
            {error}
          </div>
        )}

        {isLive && (
          <div className="p-4 rounded-lg bg-gold/10 border border-gold/20 text-gold text-footnote font-bold">
            Ce placement provient d&apos;une source externe et ne peut pas être modifié
          </div>
        )}

        {/* Name Input */}
        <div className="space-y-2">
          <label htmlFor="nom" className="text-caption font-bold text-label-tertiary">
            Nom du placement
          </label>
          <input
            id="nom"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={isLive}
            placeholder="Ex: Compte Courant BNP"
            className="w-full px-4 py-2 bg-white/5 border border-separator rounded-lg text-white text-base font-medium focus:outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Type Selection */}
        <fieldset className="space-y-2">
          <legend className="text-caption font-bold text-label-tertiary">Type de placement</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLACEMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                disabled={isLive}
                className={`py-2 px-2 rounded-lg text-caption font-bold transition-colors text-xs ${
                  type === t.value
                    ? 'bg-gold text-bg'
                    : 'bg-white/5 border border-separator text-label-tertiary hover:bg-white/10 disabled:opacity-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Amount Input */}
        <div className="space-y-2">
          <label htmlFor="montant" className="text-caption font-bold text-label-tertiary">
            Montant (€)
          </label>
          <MoneyInput
            id="montant"
            min="0"
            value={montant}
            onChange={setMontant}
            disabled={isLive}
            className="w-full px-4 py-2 bg-white/5 border border-separator rounded-lg text-white text-base font-bold focus:outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Owner Selection */}
        <div className="space-y-2">
          <label htmlFor="owner" className="text-caption font-bold text-label-tertiary">
            Propriétaire
          </label>
          <select
            id="owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={isLive}
            className="w-full px-4 py-2 bg-white/5 border border-separator rounded-lg text-white text-base font-medium focus:outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
          >
            <option value="Nicolas">Nicolas</option>
            <option value="Gwen">Gwen</option>
            <option value="Véronique">Véronique</option>
          </select>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 -mx-4 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-bg/95 backdrop-blur-md border-t border-separator flex gap-2">
          {placement && !isLive && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting}
              className="px-4 py-2 rounded-lg bg-negative/10 border border-negative/20 text-negative text-caption font-bold hover:bg-negative/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-white/5 border border-separator text-white text-caption font-bold hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isDeleting || isLive}
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
