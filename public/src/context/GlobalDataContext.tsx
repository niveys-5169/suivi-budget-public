import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { AccountBalance } from '../types/balances';
import { mapFirestoreBalance } from '../utils/balanceMapping';
import { OwnerMapping, RavConfig, Recurrence } from '../types/banking.types';
import { formatFirestoreError } from '../utils/firestoreError';
import { toast } from '../lib/toast';

interface GlobalDataContextType {
  accountBalances: AccountBalance[];
  ownerMapping: OwnerMapping;
  ravConfig: RavConfig | null;
  recurrences: Recurrence[];
  loading: boolean;
}

// Propriétaires par défaut du foyer, utilisés tant que le mapping Firestore
// (metadata/account_owners_mapping) n'a rien fourni.
const DEFAULT_OWNERS = ['Nicolas', 'Romane'];
const DEFAULT_OWNER = 'Nicolas';

const GlobalDataContext = createContext<GlobalDataContextType | undefined>(undefined);

/** Charge en une fois les données globales (comptes, récurrences, ravConfig) partagées entre sections. */
export const GlobalDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [ownerMapping, setOwnerMapping] = useState<OwnerMapping>({
    owners: [...DEFAULT_OWNERS],
    accounts: {},
    savings_patterns: {},
    default_owner: DEFAULT_OWNER,
  });
  const [ravConfig, setRavConfig] = useState<RavConfig | null>(null);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setAccountBalances([]);
      setOwnerMapping({
        owners: [...DEFAULT_OWNERS],
        accounts: {},
        savings_patterns: {},
        default_owner: DEFAULT_OWNER,
      });
      setRavConfig(null);
      setRecurrences([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubs: (() => void)[] = [];

    // `loading` ne repasse à false qu'une fois le premier snapshot (ou une
    // erreur) reçu pour chacune des 4 sources.
    const SOURCE_COUNT = 4;
    const readySources = new Set<string>();
    const markReady = (source: string) => {
      readySources.add(source);
      if (readySources.size === SOURCE_COUNT) setLoading(false);
    };
    const onError = (source: string) => (err: unknown) => {
      console.error(`[GlobalData] Erreur listener "${source}":`, err);
      toast.error(formatFirestoreError(err), undefined, `global-data-${source}`);
      markReady(source);
    };

    // 1. Account Balances
    unsubs.push(
      onSnapshot(
        collection(db, 'account_balances'),
        (snap) => {
          const balances = snap.docs.map((doc) => mapFirestoreBalance<AccountBalance>(doc));
          setAccountBalances(balances);
          markReady('balances');
        },
        onError('balances'),
      ),
    );

    // 2. Owner Mapping
    unsubs.push(
      onSnapshot(
        doc(db, 'metadata', 'account_owners_mapping'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setOwnerMapping({
              owners: data.owners || [...DEFAULT_OWNERS],
              accounts: data.accounts || {},
              savings_patterns: data.savings_patterns || {},
              default_owner: data.default_owner || DEFAULT_OWNER,
            });
          }
          markReady('owners');
        },
        onError('owners'),
      ),
    );

    // 3. RAV Config
    unsubs.push(
      onSnapshot(
        doc(db, 'metadata', 'rav_config'),
        (snap) => {
          if (snap.exists()) {
            setRavConfig(snap.data() as RavConfig);
          }
          markReady('rav');
        },
        onError('rav'),
      ),
    );

    // 4. Recurrences
    unsubs.push(
      onSnapshot(
        collection(db, 'recurrences'),
        (snap) => {
          setRecurrences(snap.docs.map((d) => ({ ...(d.data() as Recurrence), id: d.id })));
          markReady('recurrences');
        },
        onError('recurrences'),
      ),
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [user, authLoading]);

  const contextValue = useMemo(
    () => ({
      accountBalances,
      ownerMapping,
      ravConfig,
      recurrences,
      loading,
    }),
    [accountBalances, ownerMapping, ravConfig, recurrences, loading],
  );

  return <GlobalDataContext.Provider value={contextValue}>{children}</GlobalDataContext.Provider>;
};

/** Consomme GlobalDataContext — expose comptes, récurrents et config RAV avec état de chargement. */
export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (context === undefined) {
    // Return defaults for tests or when outside provider to prevent crashes
    return {
      accountBalances: [],
      ownerMapping: {
        owners: [...DEFAULT_OWNERS],
        accounts: {},
        savings_patterns: {},
        default_owner: DEFAULT_OWNER,
      },
      ravConfig: null,
      recurrences: [],
      loading: false,
    };
  }
  return context;
};
