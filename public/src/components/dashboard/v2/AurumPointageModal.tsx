import React, { useState } from 'react';
import { Modal } from '../../shared/Modal';
import { Transaction } from '../../../context/TransactionContext';
import { formatCurrency } from '../../../lib/formatters';
import { CheckCircle2, Circle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onTogglePointe: (id: string, checked: boolean) => Promise<void>;
  onEdit: (tx: Transaction) => void;
}

export const AurumPointageModal: React.FC<Props> = ({
  isOpen,
  onClose,
  transactions,
  onTogglePointe,
  onEdit,
}) => {
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());

  const handleToggle = async (id: string) => {
    if (inFlight.has(id)) return;
    setInFlight((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      await onTogglePointe(id, true);
    } catch (err) {
      console.error('Failed to toggle transaction:', err);
    } finally {
      // Small timeout or immediate removal is fine because the transaction will disappear
      // from the prop list as soon as state updates.
      setInFlight((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) =>
    (b.date || '').localeCompare(a.date || ''),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transactions à pointer"
      subtitle="Validez ou modifiez vos opérations récentes"
      size="md"
      variant="sheet"
    >
      <div className="p-6 space-y-4">
        {sortedTransactions.length === 0 ? (
          <div className="text-center py-12 text-label-tertiary font-bold text-caption">
            Aucune transaction à pointer
          </div>
        ) : (
          <div className="divide-y divide-separator">
            {sortedTransactions.map((tx) => {
              const dateStr = tx.date
                ? new Date(tx.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })
                : '';
              const amount = tx.montant ?? 0;
              const isNegative = amount < 0;

              return (
                <div
                  key={tx.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(tx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit(tx);
                    }
                  }}
                  className="flex items-center justify-between py-4 cursor-pointer hover:bg-surface px-4 -mx-4 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(tx.id);
                      }}
                      disabled={inFlight.has(tx.id)}
                      className="w-10 h-10 rounded-xl bg-white/5 border border-separator flex items-center justify-center text-white/30 hover:text-positive hover:bg-positive/10 hover:border-positive/20 disabled:opacity-50 transition-all flex-shrink-0"
                      aria-label="Pointer la transaction"
                    >
                      <Circle size={16} className="group-hover:hidden" />
                      <CheckCircle2 size={16} className="hidden group-hover:block text-positive" />
                    </button>

                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate group-hover:text-gold transition-colors">
                        {tx.libelle || 'Transaction'}
                      </p>
                      <p className="text-caption text-white/40 flex items-center gap-2 mt-1">
                        <span>{dateStr}</span>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="truncate">{tx.compte}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-sm font-serif font-bold tabular-nums ml-4 ${
                      isNegative ? 'text-negative' : 'text-positive'
                    }`}
                  >
                    {formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
