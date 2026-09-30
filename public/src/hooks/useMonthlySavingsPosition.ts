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

// Un relevé de fin de mois vaut solde d'ouverture du mois suivant : la borne accepte
// le dernier point connu dans les jours qui la précèdent.
const BOUNDARY_TOLERANCE_DAYS = 3;

const shiftDate = (date: string, days: number): string => {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

export function getMonthlySavingsBounds(month: string): {
  historyStartDate: string;
  openingDate: string;
  closingDate: string;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return { historyStartDate: '', openingDate: '', closingDate: '' };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const openingDate = `${match[1]}-${match[2]}-01`;
  return {
    historyStartDate: shiftDate(openingDate, -BOUNDARY_TOLERANCE_DAYS),
    openingDate,
    closingDate: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`,
  };
}

/** Dernier point de chaque compte à la borne, ou à défaut dans la tolérance qui la précède. */
const latestByName = (
  history: OperatingHistoryEntry[],
  boundary: string,
): Map<string, OperatingHistoryEntry> => {
  const earliest = shiftDate(boundary, -BOUNDARY_TOLERANCE_DAYS);
  const byName = new Map<string, OperatingHistoryEntry>();
  for (const entry of history) {
    if (entry.date < earliest || entry.date > boundary) continue;
    const key = normalizedName(entry.nom);
    const current = byName.get(key);
    if (!current || entry.date >= current.date) byName.set(key, entry);
  }
  return byName;
};

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
  const openingByName = latestByName(operatingHistory, openingDate);
  const closingByName = latestByName(operatingHistory, closingDate);
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
    const { historyStartDate, openingDate, closingDate } = getMonthlySavingsBounds(month);
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
              where('date', '>=', historyStartDate),
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
