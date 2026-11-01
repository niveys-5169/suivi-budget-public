import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionsEmptyState } from '../../../public/src/components/transactions/TransactionsEmptyState';
import type { TransactionFilters } from '../../../public/src/hooks/useTransactions';

const CURRENT: TransactionFilters = {
  search: '',
  compte: '',
  type: '',
  year: '2026',
  month: '10',
  pointe: '',
  categorie: '',
};

describe('TransactionsEmptyState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('explique que les filtres sont en cause et propose de les réinitialiser', () => {
    const onResetFilters = vi.fn();
    render(
      <TransactionsEmptyState
        filters={{ ...CURRENT, search: 'zzz' }}
        onResetFilters={onResetFilters}
      />,
    );

    expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('traite un autre mois que le mois courant comme un filtre actif', () => {
    render(
      <TransactionsEmptyState filters={{ ...CURRENT, month: '03' }} onResetFilters={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument();
  });

  it('sans filtre, parle du mois et propose d’ajouter une transaction', () => {
    const onAdd = vi.fn();
    render(<TransactionsEmptyState filters={CURRENT} onResetFilters={vi.fn()} onAdd={onAdd} />);

    expect(screen.getByText('Aucune transaction ce mois-ci')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réinitialiser les filtres' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une transaction' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('n’affiche aucune action quand l’écran ne propose pas d’ajout', () => {
    render(<TransactionsEmptyState filters={CURRENT} onResetFilters={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
