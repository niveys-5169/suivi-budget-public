import React from 'react';
import { FormattedNumber } from 'react-intl';
import { Check, Repeat2 } from 'lucide-react';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { MSwipeToPoint } from './MSwipeToPoint';
import type { Transaction } from '../../types/banking.types';

type MTransactionRowProps = {
  transaction: Transaction;
  onPress?: (id: string) => void;
  onTogglePointe?: (id: string, pointe: boolean) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  isRecurrent?: boolean;
};

export const MTransactionRow: React.FC<MTransactionRowProps> = ({
  transaction,
  onPress,
  onTogglePointe,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  isRecurrent = false,
}) => {
  const amount = transaction.montant || 0;
  const isPositive = amount > 0;
  const meta = getCategoryMeta(transaction.categorie);
  const isPointed = transaction.pointe ?? false;
  const isStandalone = useIsStandalone();
  // Swipe réservé à la PWA installée, hors mode sélection.
  const swipeEnabled = isStandalone && !selectionMode && Boolean(onTogglePointe);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect?.(transaction.id);
    } else {
      onPress?.(transaction.id);
    }
  };

  const row = (
    <button
      onClick={handleClick}
      className={`density-row w-full flex items-center gap-4 px-4 py-4 active:bg-surface transition-colors text-left ${!isPointed && !selectionMode ? 'opacity-60' : ''} ${selected ? 'bg-gold/10' : ''}`}
    >
      <div className="shrink-0 relative">
        {selectionMode && (
          <div
            className={`absolute inset-0 z-10 rounded-full flex items-center justify-center border-2 transition-colors ${selected ? 'bg-gold border-gold' : 'bg-raised border-white/30'}`}
          >
            {selected && <Check size={14} className="text-bg" />}
          </div>
        )}
        <CategoryIcon
          icon={meta.icon}
          size={20}
          className="density-row-icon w-10 h-10 rounded-full bg-raised flex items-center justify-center"
          color={meta.color}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-headline font-medium text-white truncate">
          {transaction.libelle || 'Sans libellé'}
        </p>
        <p className="text-footnote text-label/50 truncate">
          {transaction.categorie || 'Non catégorisé'} • {transaction.compte || 'Inconnu'}
          {transaction.commentaire ? ` • ${transaction.commentaire}` : ''}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {isRecurrent && (
          <Repeat2 size={12} className="text-positive shrink-0" aria-label="Récurrence liée" />
        )}
        <div className="text-right">
          <p
            className={`text-headline font-semibold tabular-nums ${isPositive ? 'text-positive' : 'text-white'}`}
          >
            {isPositive && '+'}
            <FormattedNumber value={Math.abs(amount)} style="currency" currency="EUR" />
          </p>
        </div>

        {onTogglePointe && !selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePointe(transaction.id, !isPointed);
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors border ${
              isPointed
                ? 'bg-gold/20 border-gold/40 text-gold'
                : 'bg-transparent border-separator text-transparent'
            }`}
            aria-label={isPointed ? 'Dépointée' : 'Pointer'}
          >
            <Check size={13} />
          </button>
        )}
      </div>
    </button>
  );

  if (swipeEnabled && onTogglePointe) {
    return (
      <MSwipeToPoint id={transaction.id} pointed={isPointed} onTogglePointe={onTogglePointe}>
        {row}
      </MSwipeToPoint>
    );
  }

  return row;
};
