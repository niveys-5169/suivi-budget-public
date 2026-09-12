import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { FormattedNumber } from 'react-intl';
import { Modal } from './Modal';
import type { Recurrence, Transaction } from '../../types/banking.types';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { CategoryIcon } from '../CategoryIcon';

interface LinkRecurrenceModalProps {
  recurrence: Recurrence | null;
  /** Candidats déjà classés par la façade (`useRecurrences().linkCandidates`). */
  candidates: Transaction[];
  onClose: () => void;
  onLink: (tx: Transaction) => void;
}

/**
 * Bottom-sheet permettant de lier manuellement une récurrence à n'importe quelle
 * transaction du vivier (au-delà de l'auto-matching). Le classement et l'étendue
 * du vivier sont décidés en amont par `useRecurrences().linkCandidates` — ce
 * composant ne fait que filtrer sur la recherche textuelle.
 */
export const LinkRecurrenceModal: React.FC<LinkRecurrenceModalProps> = ({
  recurrence,
  candidates: rankedCandidates,
  onClose,
  onLink,
}) => {
  const [search, setSearch] = useState('');

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const candidates = useMemo(() => {
    if (!recurrence) return [];
    const q = search.trim().toLowerCase();
    const targetCat = (recurrence.category || '').trim().toLowerCase();
    const targetAmt = Math.abs(recurrence.expectedAmount);

    return (
      q
        ? rankedCandidates.filter(
            (tx) =>
              (tx.libelle || '').toLowerCase().includes(q) ||
              (tx.categorie || '').toLowerCase().includes(q),
          )
        : rankedCandidates
    ).map((tx) => {
      // Purement présentationnel : le classement, lui, vient de la façade.
      const txAmt = Math.abs(tx.montant ?? 0);
      return {
        tx,
        sameCat: (tx.categorie || '').trim().toLowerCase() === targetCat,
        amountDiff: targetAmt > 0 ? Math.abs(txAmt - targetAmt) / targetAmt : 1,
      };
    });
  }, [recurrence, rankedCandidates, search]);

  if (!recurrence) return null;

  const recMeta = getCategoryMeta(recurrence.category);

  const handleLink = (tx: Transaction) => {
    onLink(tx);
    setSearch('');
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title={recurrence.label}
      subtitle={`Lier à une transaction · estimé ${Math.abs(
        recurrence.expectedAmount,
      ).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`}
      variant="sheet"
      size="sm"
      headerActions={
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${recMeta.color}20`, color: recMeta.color }}
        >
          <CategoryIcon icon={recMeta.icon} size={16} color={recMeta.color} />
        </div>
      }
    >
      <div className="flex flex-col">
        {/* Search */}
        <div className="p-4 border-b border-separator flex-shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-label-tertiary"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une transaction..."
              className="w-full bg-white/5 border border-separator rounded-lg pl-8 pr-4 py-2 text-white text-base placeholder-zinc-600 focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
        </div>

        {/* Candidates */}
        <div className="p-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          {candidates.length === 0 ? (
            <p className="py-10 text-center text-label-tertiary text-body">
              {search.trim() ? 'Aucune transaction trouvée.' : 'Aucune transaction ce mois-ci.'}
            </p>
          ) : (
            <div className="divide-y divide-separator">
              {candidates.map(({ tx, sameCat, amountDiff }) => {
                const meta = getCategoryMeta(tx.categorie || '');
                return (
                  <button
                    key={tx.id}
                    onClick={() => handleLink(tx)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                    >
                      <CategoryIcon icon={meta.icon} size={14} color={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-footnote font-medium text-white truncate">
                        {tx.libelle || 'Transaction'}
                      </p>
                      <p className="text-caption text-label-tertiary truncate">
                        {tx.categorie || 'Sans catégorie'}
                        {tx.date && ` · ${formatDay(tx.date)}`}
                        {sameCat
                          ? ' · même catégorie'
                          : ` · écart ${(amountDiff * 100).toFixed(0)}%`}
                      </p>
                    </div>
                    <span className="text-footnote font-semibold tabular-nums text-white shrink-0">
                      <FormattedNumber
                        value={Math.abs(tx.montant ?? 0)}
                        style="currency"
                        currency="EUR"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
