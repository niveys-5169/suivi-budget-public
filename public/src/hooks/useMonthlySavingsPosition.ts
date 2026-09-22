import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useGlobalData } from '../context/GlobalDataContext';
import { mapFirestoreBalance } from '../utils/balanceMapping';
import { calculateMonthlySavingsPosition } from '../utils/monthlySavings';
import type {
  AccountBalance,
  MonthlySavingsAccount,
  MonthlySavingsPosition,
  SavingsBalance,
  Transaction,
} from '../types/banking.types';

interface OperatingHistoryEntry {
  assetId: string;
  date: string;
  nom: string;
  montant: number;
  type: string;
  owner?: string;
}

interface BuildAccountsInput {
  month: string;
  isCompleteMonth: boolean;
  liveOperatingBalances: Array<Partial<AccountBalance> & { id: string }>;
  savingsBalances: Array<Partial<SavingsBalance> & { id: string }>;
  history: OperatingHistoryEntry[];
}

const normalizedName = (value: string | undefined): string =>
  (value || '').trim().toLocaleLowerCase('fr');

export function getMonthlySavingsBounds(month: string): {
  openingDate: string;
  closingDate: string;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { openingDate: '', closingDate: '' };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  return {
    openingDate: `${match[1]}-${match[2]}-01`,
    closingDate: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`,
  };
}

const finiteBalance = (value: unknown): number | null => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

/** Normalise les snapshots Firestore en comptes consommables par le moteur pur. */
export function buildMonthlySavingsAccounts(input: BuildAccountsInput): MonthlySavingsAccount[] {
  const { openingDate, closingDate } = getMonthlySavingsBounds(input.month);
  const operatingHistory = input.history.filter((entry) => {
    const type = entry.type.trim().toLocaleLowerCase('fr');
    return ['courants', 'courant', 'cash', 'liquidités', 'liquidites'].includes(type);
  });
  const openingByName = new Map(
    operatingHistory
      .filter((entry) => entry.date === openingDate)
      .map((entry) => [normalizedName(entry.nom), entry] as const),
  );
  const closingByName = new Map(
    operatingHistory
      .filter((entry) => entry.date === closingDate)
      .map((entry) => [normalizedName(entry.nom), entry] as const),
  );
  const liveByName = new Map(
    input.liveOperatingBalances.map(
      (balance) => [normalizedName(balance.compte), balance] as const,
    ),
  );

  const names = new Set<string>([
    ...openingByName.keys(),
    ...closingByName.keys(),
    ...liveByName.keys(),
  ]);

  const operatingAccounts = [...names].filter(Boolean).map((key): MonthlySavingsAccount => {
    const opening = openingByName.get(key);
    const closing = closingByName.get(key);
    const live = liveByName.get(key);
    const name = opening?.nom || closing?.nom || live?.compte || key;
    return {
      id: opening?.assetId || closing?.assetId || live?.id || key,
      name,
      role: 'OPERATING',
      owner: opening?.owner || closing?.owner || live?.owner,
      openingBalance: opening ? finiteBalance(opening.montant) : null,
      closingBalance: input.isCompleteMonth
        ? closing
          ? finiteBalance(closing.montant)
          : null
        : live
          ? finiteBalance(live.current_balance ?? live.solde)
          : null,
    };
  });

  const savingsAccounts = input.savingsBalances.map((balance): MonthlySavingsAccount => ({
    id: balance.id,
    name: balance.compte || balance.id,
    role: 'SAVINGS',
    owner: balance.owner,
    openingBalance: null,
    closingBalance: null,
  }));

  return [...operatingAccounts, ...savingsAccounts].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr'),
  );
}

const currentMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export function useMonthlySavingsPosition(
  month: string,
  transactions: Transaction[],
): { position: MonthlySavingsPosition | null; loading: boolean; error: Error | null } {
  const { accountBalances = [], loading: globalLoading = false } = useGlobalData();
  const [history, setHistory] = useState<OperatingHistoryEntry[]>([]);
  const [savingsBalances, setSavingsBalances] = useState<SavingsBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isCompleteMonth = month < currentMonthKey();

  useEffect(() => {
    const { openingDate, closingDate } = getMonthlySavingsBounds(month);
    if (!openingDate || globalLoading) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [historySnapshot, savingsSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(db, 'placement_history'),
              where('date', '>=', openingDate),
              where('date', '<=', closingDate),
              orderBy('date', 'asc'),
            ),
          ),
          getDocs(collection(db, 'savings_balances')),
        ]);
        if (cancelled) return;
        setHistory(
          historySnapshot.docs.flatMap((snapshot) => {
            const data = snapshot.data();
            const montant = finiteBalance(data.montant ?? data.amount ?? data.value);
            if (!data.date || !data.nom || !data.type || montant === null) return [];
            return [
              {
                assetId: String(data.assetId || snapshot.id),
                date: String(data.date).slice(0, 10),
                nom: String(data.nom),
                montant,
                type: String(data.type),
                owner: data.owner ? String(data.owner) : undefined,
              },
            ];
          }),
        );
        setSavingsBalances(
          savingsSnapshot.docs.map((snapshot) => mapFirestoreBalance<SavingsBalance>(snapshot)),
        );
      } catch (cause) {
        if (cancelled) return;
        setHistory([]);
        setSavingsBalances([]);
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [globalLoading, month]);

  const position = useMemo(() => {
    if (loading || globalLoading) return null;
    const accounts = buildMonthlySavingsAccounts({
      month,
      isCompleteMonth,
      liveOperatingBalances: accountBalances,
      savingsBalances,
      history,
    });
    return calculateMonthlySavingsPosition({
      month,
      accounts,
      transactions,
      isCompleteMonth,
    });
  }, [
    accountBalances,
    globalLoading,
    history,
    isCompleteMonth,
    loading,
    month,
    savingsBalances,
    transactions,
  ]);

  return { position, loading: loading || globalLoading, error };
}
