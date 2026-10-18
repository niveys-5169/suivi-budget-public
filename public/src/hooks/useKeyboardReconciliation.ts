import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '../types/banking.types';

export interface UseKeyboardReconciliationOptions {
  transactions: Transaction[];
  onTogglePointe: (id: string, nextPointe: boolean) => void;
  enabled?: boolean;
}

/**
 * Hook de réconciliation rapide au clavier (Speed Reconciliation).
 * - `j` / `ArrowDown` : sélectionne l'opération suivante
 * - `k` / `ArrowUp` : sélectionne l'opération précédente
 * - `Espace` : pointe/dépointe l'opération courante et avance automatiquement
 * - `Escape` : désélectionne
 */
export function useKeyboardReconciliation({
  transactions,
  onTogglePointe,
  enabled = true,
}: UseKeyboardReconciliationOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    if (selectedIndex >= transactions.length) {
      setSelectedIndex(transactions.length > 0 ? transactions.length - 1 : -1);
    }
  }, [transactions.length, selectedIndex]);

  const selectNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (transactions.length === 0) return -1;
      if (prev === -1) return 0;
      return prev < transactions.length - 1 ? prev + 1 : prev;
    });
  }, [transactions.length]);

  const selectPrev = useCallback(() => {
    setSelectedIndex((prev) => {
      if (transactions.length === 0) return -1;
      return prev > 0 ? prev - 1 : 0;
    });
  }, [transactions.length]);

  const pointCurrentAndAdvance = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= transactions.length) return;
    const currentTx = transactions[selectedIndex];
    if (!currentTx) return;

    onTogglePointe(currentTx.id, !currentTx.pointe);

    // Avance automatiquement à la transaction suivante si disponible
    if (selectedIndex < transactions.length - 1) {
      setSelectedIndex((prev) => prev + 1);
    }
  }, [selectedIndex, transactions, onTogglePointe]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectNext();
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectPrev();
      } else if (e.code === 'Space') {
        if (selectedIndex >= 0) {
          e.preventDefault();
          pointCurrentAndAdvance();
        }
      } else if (e.key === 'Escape') {
        setSelectedIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, selectNext, selectPrev, pointCurrentAndAdvance, selectedIndex]);

  return {
    selectedIndex,
    setSelectedIndex,
    selectedTxId: selectedIndex >= 0 ? transactions[selectedIndex]?.id : null,
    selectNext,
    selectPrev,
    pointCurrentAndAdvance,
  };
}
