import { useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';

/** Retourne les soldes des comptes bancaires en temps réel depuis Firestore. */
export const useBalances = () => {
  const { accountBalances, loading } = useGlobalData();
  const totalBalance = useMemo(
    () => accountBalances.reduce((sum, b) => sum + (Number(b.current_balance ?? b.solde) || 0), 0),
    [accountBalances],
  );
  const checkingBalances = useMemo(
    () => accountBalances.filter((b) => !b.is_savings),
    [accountBalances],
  );
  const checkingTotal = useMemo(
    () => checkingBalances.reduce((sum, b) => sum + (Number(b.current_balance ?? b.solde) || 0), 0),
    [checkingBalances],
  );
  return {
    balances: accountBalances,
    totalBalance,
    checkingBalances,
    checkingTotal,
    loading,
    error: null,
  };
};
