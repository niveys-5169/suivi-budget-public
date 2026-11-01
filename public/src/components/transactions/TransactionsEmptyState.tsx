import React from 'react';
import { Receipt, Search } from 'lucide-react';
import { EmptyState } from '../../ui';
import type { TransactionFilters } from '../../hooks/useTransactions';

interface TransactionsEmptyStateProps {
  filters: TransactionFilters;
  onResetFilters: () => void;
  /** Ouvre le formulaire d'ajout, quand l'écran en propose un. */
  onAdd?: () => void;
}

/** Vrai dès que la liste est restreinte par autre chose que le mois courant. */
export const hasActiveFilters = (f: TransactionFilters): boolean => {
  const now = new Date();
  return (
    Boolean(f.search || f.compte || f.type || f.pointe || f.categorie) ||
    f.year !== String(now.getFullYear()) ||
    Number(f.month) !== now.getMonth() + 1
  );
};

/** Liste de transactions vide : dit si ce sont les filtres ou le mois qui sont en cause. */
export const TransactionsEmptyState: React.FC<TransactionsEmptyStateProps> = ({
  filters,
  onResetFilters,
  onAdd,
}) =>
  hasActiveFilters(filters) ? (
    <EmptyState
      icon={<Search size={24} />}
      title="Aucune transaction trouvée"
      description="Aucune opération ne correspond à la recherche, à la période ou aux filtres actifs."
      action={{ label: 'Réinitialiser les filtres', onClick: onResetFilters }}
    />
  ) : (
    <EmptyState
      icon={<Receipt size={24} />}
      title="Aucune transaction ce mois-ci"
      description="Les opérations de vos comptes apparaîtront ici dès leur synchronisation."
      action={onAdd ? { label: 'Ajouter une transaction', onClick: onAdd } : undefined}
    />
  );
