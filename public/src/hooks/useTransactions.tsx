import { useTransactionContext } from '../context/TransactionContext';
import { Transaction } from '../types/banking.types';

/** Raccourci vers useTransactionContext — expose la liste filtrée, les filtres actifs et les CRUD. */
export const useTransactions = useTransactionContext;

// Re-export types for backward compatibility
export type { TransactionFilters } from '../context/TransactionContext';
export type { Transaction };
