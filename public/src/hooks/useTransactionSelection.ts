import { useCallback, useState } from 'react';

export interface TransactionSelection {
  /** Mode sélection actif : les cartes affichent une case et le clic coche au lieu d'ouvrir. */
  selectionMode: boolean;
  /** Identifiants actuellement sélectionnés. */
  selectedIds: Set<string>;
  enterSelection: () => void;
  /** Quitte le mode sélection et vide la sélection. */
  exitSelection: () => void;
  toggleSelectionMode: () => void;
  toggleSelect: (id: string) => void;
  /** Sélectionne l'ensemble fourni (typiquement les transactions filtrées visibles). */
  selectAll: (ids: string[]) => void;
  /** Vide la sélection sans quitter le mode. */
  clear: () => void;
}

/** État UI pur de sélection multiple des transactions (aucune donnée Firestore). */
export function useTransactionSelection(): TransactionSelection {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const enterSelection = useCallback(() => setSelectionMode(true), []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectionMode,
    selectedIds,
    enterSelection,
    exitSelection,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    clear,
  };
}
