import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './useAuth';
import { db } from '../services/firebase';
import type { BankConnection, BankReconciliationReport } from '../types/banking.types';

interface BankingData {
  connections: BankConnection[];
  reports: BankReconciliationReport[];
  now: number;
  loading: boolean;
  error: string | null;
}
const empty: BankingData = {
  connections: [],
  reports: [],
  now: Date.now(),
  loading: false,
  error: null,
};
export const BankingDataContext = createContext<BankingData>(empty);

export const BankingDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState<BankingData>(empty);
  useEffect(() => {
    if (!user) return;
    const ready = new Set<string>();
    const unsubscribers = ['bank_connections', 'bank_reports'].map((name) =>
      onSnapshot(
        collection(db, name),
        (snapshot) => {
          ready.add(name);
          const values = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
          setData((old) => ({
            ...old,
            ...(name === 'bank_connections'
              ? { connections: values as BankConnection[] }
              : { reports: values as BankReconciliationReport[] }),
            loading: ready.size < 2,
            error: null,
          }));
        },
        () =>
          setData((old) => ({
            ...old,
            loading: false,
            error: 'Suivi bancaire indisponible. Vérifiez le déploiement et les droits d’accès.',
          })),
      ),
    );
    const timer = setInterval(() => setData((old) => ({ ...old, now: Date.now() })), 60_000);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      clearInterval(timer);
    };
  }, [user]);
  return (
    <BankingDataContext.Provider value={user ? data : empty}>
      {children}
    </BankingDataContext.Provider>
  );
};
export const useBankingData = () => useContext(BankingDataContext);

export { bankDateMillis } from '../utils/bankDateMillis';
