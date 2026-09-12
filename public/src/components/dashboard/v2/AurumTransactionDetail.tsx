import React, { useState } from 'react';
import { Save, Trash2, CheckCircle2 } from 'lucide-react';
import { Transaction } from '../../../context/TransactionContext';
import { Modal } from '../../shared/Modal';

import { formatCurrency } from '../../../lib/formatters';
import { useRecurrences } from '../../../hooks/useRecurrences';
import { confirm } from '../../../lib/confirm';

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onSave: (data: Partial<Transaction>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const AurumTransactionDetail: React.FC<Props> = ({
  transaction,
  onClose,
  onSave,
  onDelete,
}) => {
  const {
    mappings: { linkedTxToRecurrence, candidateTxToRecurrence },
    link,
    unlink,
  } = useRecurrences();

  const [edited, setEdited] = useState({
    libelle: transaction.libelle || '',
    categorie: transaction.categorie || '',
    commentaire: transaction.commentaire || '',
    pointe: !!transaction.pointe,
    moisAffectation: transaction.moisAffectation || (transaction.date || '').slice(0, 7),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave({ id: transaction.id, ...edited });
      onClose();
    } catch (err) {
      console.error('Failed to save transaction details:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (await confirm({ message: 'Êtes-vous sûr de vouloir supprimer ce flux ?', danger: true })) {
      try {
        await onDelete(transaction.id);
        onClose();
      } catch (err) {
        console.error('Failed to delete transaction:', err);
      }
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Détail du Flux" subtitle="Flux de trésorerie" size="md">
      <div className="p-6 space-y-6">
        {/* Pointage status + amount */}
        <div className="space-y-4 text-center">
          <button
            onClick={() => setEdited({ ...edited, pointe: !edited.pointe })}
            className={`mx-auto w-14 h-14 rounded-full border flex items-center justify-center transition-all duration-500 ${edited.pointe ? 'bg-gold/20 border-gold text-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'bg-white/5 border-separator text-label-tertiary'}`}
          >
            <CheckCircle2 size={28} strokeWidth={edited.pointe ? 3 : 2} />
          </button>
          <p
            className={`font-serif text-4xl font-semibold tabular-nums leading-none transition-colors ${edited.pointe ? 'text-gold' : 'text-white'}`}
          >
            {formatCurrency(transaction.montant ?? 0)}
          </p>
        </div>

        <div className="space-y-4">
          {/* Pointage toggle row */}
          <button
            onClick={() => setEdited({ ...edited, pointe: !edited.pointe })}
            className={`w-full min-h-[44px] rounded-control border flex items-center justify-between px-4 transition-all ${edited.pointe ? 'bg-gold/10 border-gold/30' : 'bg-surface border-separator'}`}
          >
            <span className="text-caption font-semibold text-white/40">Statut de Pointage</span>
            <div
              className={`px-4 py-1 rounded-full text-caption font-semibold ${edited.pointe ? 'bg-gold text-bg' : 'bg-white/10 text-white/40'}`}
            >
              {edited.pointe ? 'Pointé' : 'À pointer'}
            </div>
          </button>

          {/* Suggestion / Link state in details */}
          {linkedTxToRecurrence[transaction.id] && (
            <div className="p-4 rounded-xl bg-positive/5 border border-positive/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-positive">✓</span>
                <p className="text-xs font-semibold text-positive">
                  Lié à la récurrence :{' '}
                  <strong className="text-white">
                    {linkedTxToRecurrence[transaction.id]!.label}
                  </strong>
                </p>
              </div>
              <button
                onClick={async () => {
                  await unlink(linkedTxToRecurrence[transaction.id]!.id, transaction.id);
                  onClose();
                }}
                className="px-4 py-1 rounded-lg bg-white/5 border border-separator text-white/60 text-caption font-semibold hover:bg-white/10 hover:text-white transition-all"
              >
                Délier
              </button>
            </div>
          )}

          {candidateTxToRecurrence[transaction.id] && !linkedTxToRecurrence[transaction.id] && (
            <div className="p-4 rounded-xl bg-gold/5 border border-gold/15 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gold">🔗</span>
                <p className="text-xs font-semibold text-gold-light">
                  Cette transaction correspond à la récurrence{' '}
                  <strong className="text-white">
                    {candidateTxToRecurrence[transaction.id]!.label}
                  </strong>
                  .
                </p>
              </div>
              <button
                onClick={async () => {
                  await link(candidateTxToRecurrence[transaction.id]!, transaction);
                  onClose();
                }}
                className="w-full py-2 rounded-lg bg-gold text-bg text-xs font-semibold hover:bg-gold-light transition-all shadow-md shadow-gold/10"
              >
                Lier à la récurrence & Pointer
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="tx-mois-affectation"
              className="text-caption font-semibold text-white/30"
            >
              Mois d&apos;affectation
            </label>
            <input
              id="tx-mois-affectation"
              type="month"
              value={edited.moisAffectation}
              onChange={(e) => setEdited({ ...edited, moisAffectation: e.target.value })}
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator px-4 text-base font-semibold text-white focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tx-description" className="text-caption font-semibold text-white/30">
              Description
            </label>
            <input
              id="tx-description"
              value={edited.libelle}
              onChange={(e) => setEdited({ ...edited, libelle: e.target.value })}
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator px-4 text-base font-semibold text-white focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tx-categorie" className="text-caption font-semibold text-white/30">
              Catégorie
            </label>
            <input
              id="tx-categorie"
              value={edited.categorie}
              onChange={(e) => setEdited({ ...edited, categorie: e.target.value })}
              placeholder="Ex: Courses, Loisirs..."
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator px-4 text-base font-semibold text-white focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tx-commentaire" className="text-caption font-semibold text-white/30">
              Note Privée
            </label>
            <textarea
              id="tx-commentaire"
              value={edited.commentaire}
              onChange={(e) => setEdited({ ...edited, commentaire: e.target.value })}
              placeholder="Ajouter un commentaire..."
              className="w-full h-24 rounded-control bg-surface border border-separator p-4 text-base font-semibold text-white focus:outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all resize-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pb-safe">
          <button
            onClick={handleDelete}
            className="min-h-[44px] rounded-control bg-negative/5 border border-negative/20 text-negative font-semibold text-caption hover:bg-negative/10 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Supprimer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] rounded-control bg-gold text-bg font-semibold text-caption hover:bg-gold-light transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20 disabled:opacity-50"
          >
            {saving ? (
              '...'
            ) : (
              <>
                <Save size={16} /> Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
