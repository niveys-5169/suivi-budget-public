import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { onSnapshot, FirestoreError } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { state } from '../store';
import { filterTransactions } from '../utils/filterTransactions';
import { useFirestoreErrorHandler } from '../hooks/useFirestoreErrorHandler';
import { Transaction } from '../types/banking.types';
import {
  normalizeTransaction,
  buildTransactionQuery,
  updatePointe,
  removeTransaction,
  persistTransaction,
  batchSetPointe,
  batchUpdateTransactions,
  batchRemoveTransactions,
  isRechargeDomicile,
  createEdfCreditForRecharge,
  deleteAllEdfCredits,
} from '../services/transactionRepository';

export type { Transaction };

export interface TransactionFilters {
  search: string;
  compte: string;
  type: '' | 'dep' | 'rec';
  year: string;
  month: string;
  pointe: '' | 'oui' | 'non';
  categorie: string;
}

interface TransactionContextProps {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: Error | null;
  filters: TransactionFilters;
  updateFilters: (newFilters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  togglePointe: (id: string, checked: boolean) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  saveTransaction: (transaction: Partial<Transaction> & { id?: string }) => Promise<void>;
  pointAll: () => Promise<void>;
  unpointAll: () => Promise<void>;
  bulkUpdate: (ids: string[], patch: Partial<Transaction>) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkSetPointe: (ids: string[], pointe: boolean) => Promise<void>;
  requestFullLoad: () => void;
}

export const TransactionContext = createContext<TransactionContextProps | undefined>(undefined);

/** Charge les transactions Firestore en temps réel et expose filtres, CRUD et dédoublonnage. */
export const TransactionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { handle: handleFsError } = useFirestoreErrorHandler();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [version, setVersion] = useState(0);

  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const now = new Date();
    return {
      search: '',
      compte: '',
      type: '',
      year: now.getFullYear().toString(),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      pointe: '',
      categorie: '',
    };
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTransactions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setHasMore(true);

    try {
      const txQuery = buildTransactionQuery(!!state.TX_LOAD_ALL);

      const unsubscribe = onSnapshot(
        txQuery,
        (querySnapshot) => {
          try {
            const txData: Transaction[] = querySnapshot.docs
              .map((doc) => normalizeTransaction({ id: doc.id, ...doc.data() }))
              .filter((tx): tx is Transaction => tx !== null);

            setTransactions(txData);

            setHasMore(!state.TX_LOAD_ALL);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('>>> TransactionContext: Error processing snapshot:', err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        },
        (err: FirestoreError) => {
          console.error('>>> TransactionContext: Firestore error:', err);
          const errorMsg =
            err?.code === 'permission-denied' ? new Error('Accès refusé aux transactions') : err;
          setError(errorMsg instanceof Error ? errorMsg : new Error(String(errorMsg)));
          setLoading(false);
        },
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('>>> TransactionContext: Setup error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
      return;
    }
  }, [user, authLoading, version]);

  const requestFullLoad = useCallback(() => {
    if (!state.TX_LOAD_ALL) {
      state.TX_LOAD_ALL = true;
      setVersion((v) => v + 1);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || !user || state.TX_LOAD_ALL) return;
    requestFullLoad();
  }, [hasMore, user, requestFullLoad]);

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters, debouncedSearch),
    [transactions, filters, debouncedSearch],
  );

  // Crée/supprime le crédit EDF compensateur quand une recharge Tronity
  // est pointée/dépointée (la déduction EDF n'existe qu'au pointage).
  const syncEdfCredit = useCallback(
    async (recharge: Transaction, checked: boolean) => {
      if (!isRechargeDomicile(recharge)) return;
      if (checked) {
        await createEdfCreditForRecharge(recharge);
      } else {
        await deleteAllEdfCredits(recharge.id);
      }
    },
    [transactions],
  );

  const togglePointe = useCallback(
    async (id: string, checked: boolean) => {
      try {
        await updatePointe(id, checked);
        const tx = transactions.find((t) => t.id === id);
        if (tx) await syncEdfCredit(tx, checked);
      } catch (err) {
        handleFsError(err, {
          context: 'tx.togglePointe',
          extras: { id },
          fallbackKey: 'error.fs.fallback.tx.toggle',
        });
        throw err;
      }
    },
    [handleFsError, transactions, syncEdfCredit],
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      try {
        await removeTransaction(id);
      } catch (err) {
        handleFsError(err, {
          context: 'tx.deleteTransaction',
          extras: { id },
          fallbackKey: 'error.fs.fallback.tx.delete',
        });
        throw err;
      }
    },
    [handleFsError],
  );

  const saveTransaction = useCallback(
    async (transaction: Partial<Transaction> & { id?: string }) => {
      try {
        await persistTransaction(transaction);
      } catch (err) {
        handleFsError(err, {
          context: 'tx.saveTransaction',
          extras: { id: transaction.id },
          fallbackKey: 'error.fs.fallback.tx.save',
        });
        throw err;
      }
    },
    [handleFsError],
  );

  const updateFilters = useCallback((newFilters: Partial<TransactionFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    const now = new Date();
    setFilters({
      search: '',
      compte: '',
      type: '',
      year: now.getFullYear().toString(),
      month: (now.getMonth() + 1).toString().padStart(2, '0'),
      pointe: '',
      categorie: '',
    });
  }, []);

  const pointAll = useCallback(async () => {
    try {
      const toPoint = filteredTransactions.filter((tx) => !tx.pointe);
      await batchSetPointe(toPoint, true);
      for (const tx of toPoint.filter(isRechargeDomicile)) {
        await syncEdfCredit(tx, true);
      }
    } catch (err) {
      handleFsError(err, {
        context: 'tx.pointAll',
        fallbackKey: 'error.fs.fallback.tx.pointAll',
      });
      throw err;
    }
  }, [filteredTransactions, handleFsError, syncEdfCredit]);

  const unpointAll = useCallback(async () => {
    try {
      const toUnpoint = filteredTransactions.filter((tx) => tx.pointe);
      await batchSetPointe(toUnpoint, false);
      for (const tx of toUnpoint.filter(isRechargeDomicile)) {
        await syncEdfCredit(tx, false);
      }
    } catch (err) {
      handleFsError(err, {
        context: 'tx.unpointAll',
        fallbackKey: 'error.fs.fallback.tx.unpointAll',
      });
      throw err;
    }
  }, [filteredTransactions, handleFsError, syncEdfCredit]);

  const bulkUpdate = useCallback(
    async (ids: string[], patch: Partial<Transaction>) => {
      if (ids.length === 0) return;
      try {
        await batchUpdateTransactions(ids, patch);
      } catch (err) {
        handleFsError(err, {
          context: 'tx.bulkUpdate',
          extras: { count: ids.length },
          fallbackKey: 'error.fs.fallback.tx.save',
        });
        throw err;
      }
    },
    [handleFsError],
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        await batchRemoveTransactions(ids);
      } catch (err) {
        handleFsError(err, {
          context: 'tx.bulkDelete',
          extras: { count: ids.length },
          fallbackKey: 'error.fs.fallback.tx.delete',
        });
        throw err;
      }
    },
    [handleFsError],
  );

  const bulkSetPointe = useCallback(
    async (ids: string[], pointe: boolean) => {
      if (ids.length === 0) return;
      try {
        const idSet = new Set(ids);
        const targets = transactions.filter((tx) => idSet.has(tx.id) && tx.pointe !== pointe);
        await batchSetPointe(targets, pointe);
        for (const tx of targets.filter(isRechargeDomicile)) {
          await syncEdfCredit(tx, pointe);
        }
      } catch (err) {
        handleFsError(err, {
          context: 'tx.bulkSetPointe',
          extras: { count: ids.length },
          fallbackKey: pointe ? 'error.fs.fallback.tx.pointAll' : 'error.fs.fallback.tx.unpointAll',
        });
        throw err;
      }
    },
    [transactions, handleFsError, syncEdfCredit],
  );

  const contextValue = useMemo(
    () => ({
      transactions,
      filteredTransactions,
      loading,
      loadingMore: false,
      hasMore,
      loadMore,
      error,
      filters,
      updateFilters,
      resetFilters,
      togglePointe,
      deleteTransaction,
      saveTransaction,
      pointAll,
      unpointAll,
      bulkUpdate,
      bulkDelete,
      bulkSetPointe,
      requestFullLoad,
    }),
    [
      transactions,
      filteredTransactions,
      loading,
      hasMore,
      loadMore,
      error,
      filters,
      updateFilters,
      resetFilters,
      togglePointe,
      deleteTransaction,
      saveTransaction,
      pointAll,
      unpointAll,
      bulkUpdate,
      bulkDelete,
      bulkSetPointe,
      requestFullLoad,
    ],
  );

  return <TransactionContext.Provider value={contextValue}>{children}</TransactionContext.Provider>;
};

/** Consomme TransactionContext — lever si utilisé hors TransactionProvider. */
export const useTransactionContext = () => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactionContext must be used within a TransactionProvider');
  }
  return context;
};
