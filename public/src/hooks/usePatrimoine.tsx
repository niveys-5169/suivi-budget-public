import { useState, useEffect, useMemo, useCallback } from 'react';
import { z } from 'zod';
import { collection, doc, onSnapshot, query, orderBy, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { SavingsBalance, AccountBalance } from '../types/balances';
export type { SavingsBalance, AccountBalance };
import { mapFirestoreBalance } from '../utils/balanceMapping';
import { PatrimoineSnapshot, OwnerSnapshot, WealthHistoryEntry } from '../types/patrimoine';
export type { WealthHistoryEntry } from '../types/patrimoine';
import { toMillis } from '../utils/firestoreDate';

export interface Placement {
  id: string;
  nom: string;
  owner: string;
  type: string;
  montant: number;
  commentaire?: string;
}

const PlacementDocZ = z.object({
  nom: z.string(),
  montant: z.coerce.number(),
  owner: z.string().default(''),
  type: z.string().default('autre'),
  commentaire: z.string().optional(),
});

const WealthHistoryEntryDocZ = z.object({ date: z.string() }).passthrough();

const PatrimoineSnapshotDocZ = z.object({
  monthKey: z.string(),
  date: z.string(),
  owners: z.record(z.string(), z.unknown()),
});

export interface OwnerMapping {
  owners: string[];
  accounts: Record<string, string>;
  savings_patterns: Record<string, string>;
  default_owner: string;
}

import { useGlobalData } from '../context/GlobalDataContext';
import { cleanupHistoryDuplicates, reportDuplicates } from '../utils/cleanupDuplicates';
import { buildWealthTimeline } from '../utils/wealthTimeline';
import { computeWealthTotals } from '../utils/wealthSnapshot';
import { withRetry } from '../utils/withRetry';

/** Agrège comptes épargne, placements et historique patrimonial en une seule interface réactive. */
export const usePatrimoine = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    accountBalances,
    ownerMapping: globalOwnerMapping,
    loading: globalLoading,
  } = useGlobalData();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [savingsBalances, setSavingsBalances] = useState<SavingsBalance[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [placementHistory, setPlacementHistory] = useState<WealthHistoryEntry[]>([]);
  const [patrimoineSnapshots, setPatrimoineSnapshots] = useState<PatrimoineSnapshot[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || globalLoading) return;
    if (!user) {
      setPlacements([]);
      setSavingsBalances([]);
      setPortfolioValue(0);
      setPlacementHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // `loading` ne repasse à false qu'une fois le premier snapshot (ou une
    // erreur) reçu pour chacune des 5 sources.
    const SOURCE_COUNT = 5;
    const readySources = new Set<string>();
    const markReady = (source: string) => {
      readySources.add(source);
      if (readySources.size === SOURCE_COUNT) setLoading(false);
    };

    // 1. Placements
    const unsubPlacements = onSnapshot(
      collection(db, 'placements'),
      (snap) => {
        setPlacements(
          snap.docs.flatMap((d) => {
            const r = PlacementDocZ.safeParse(d.data());
            if (!r.success) return [];
            return [{ id: d.id, ...r.data } as Placement];
          }),
        );
        markReady('placements');
      },
      (err) => {
        console.error('>>> usePatrimoine: Placements error:', err);
        markReady('placements');
      },
    );

    // 2. Savings Balances
    const unsubSavings = onSnapshot(
      collection(db, 'savings_balances'),
      (snap) => {
        setSavingsBalances(snap.docs.map((doc) => mapFirestoreBalance<SavingsBalance>(doc)));
        markReady('savings');
      },
      (err) => {
        console.error('>>> usePatrimoine: Savings error:', err);
        markReady('savings');
      },
    );

    // 3. Patrimoine Settings (Portfolio Fallback)
    const unsubSettings = onSnapshot(
      doc(db, 'metadata', 'patrimoine_settings'),
      (snap) => {
        if (snap.exists()) {
          const val = Number(snap.data().portfolioValue) || 0;
          setPortfolioValue(val);
        }
        markReady('settings');
      },
      (err) => {
        console.error('>>> usePatrimoine: Settings error:', err);
        markReady('settings');
      },
    );

    // 4. History
    const qHistory = query(collection(db, 'placement_history'), orderBy('date', 'asc'));
    const unsubHistory = onSnapshot(
      qHistory,
      (snap) => {
        const history = snap.docs.flatMap((d) => {
          const r = WealthHistoryEntryDocZ.safeParse(d.data());
          if (!r.success) return [];
          return [{ id: d.id, ...r.data } as WealthHistoryEntry];
        });
        setPlacementHistory(history);

        const latestPortfolioEntry = history
          .filter((entry) => {
            const normalizedType = String(entry?.type || '').toLowerCase();
            return ['portefeuille', 'portfolio', 'bourse'].includes(normalizedType);
          })
          .sort((a, b) => {
            const getVal = (entry: WealthHistoryEntry) => {
              return toMillis(entry.date ?? entry.createdAt);
            };
            const dateA = getVal(a);
            const dateB = getVal(b);
            return dateB - dateA;
          })[0];

        if (latestPortfolioEntry) {
          const inferredValue =
            Number(
              latestPortfolioEntry?.montant ??
                latestPortfolioEntry?.amount ??
                latestPortfolioEntry?.value ??
                0,
            ) || 0;
          setPortfolioValue(inferredValue);
        }
        markReady('history');
      },
      (err) => {
        console.error('>>> usePatrimoine: History error:', err);
        markReady('history');
      },
    );

    // 4b. Patrimoine snapshots (monthly full snapshot per owner)
    const qSnapshots = query(collection(db, 'patrimoine_snapshots'), orderBy('date', 'asc'));
    const unsubSnapshots = onSnapshot(
      qSnapshots,
      (snap) => {
        setPatrimoineSnapshots(
          snap.docs.flatMap((d) => {
            const r = PatrimoineSnapshotDocZ.safeParse(d.data());
            if (!r.success) return [];
            return [{ id: d.id, ...r.data } as PatrimoineSnapshot];
          }),
        );
        setSnapshotsLoaded(true);
        markReady('snapshots');
      },
      (err) => {
        console.error('>>> usePatrimoine: Snapshots error:', err);
        setSnapshotsLoaded(true);
        markReady('snapshots');
      },
    );

    return () => {
      unsubPlacements();
      unsubSavings();
      unsubSettings();
      unsubHistory();
      unsubSnapshots();
    };
  }, [user, authLoading, globalLoading]);

  const ownerMapping = globalOwnerMapping || {
    owners: ['Nicolas', 'Romane'],
    accounts: {},
    savings_patterns: {},
    default_owner: 'Nicolas',
  };

  // Compute Totals & Distributions
  const totals = useMemo(() => {
    const t = computeWealthTotals(accountBalances, savingsBalances, placements, portfolioValue);
    return { ...t, netWorth: t.total };
  }, [placements, savingsBalances, accountBalances, portfolioValue]);

  const savePlacement = useCallback(async (data: Partial<Placement>) => {
    const id = data.id || doc(collection(db, 'placements')).id;
    await withRetry(() =>
      setDoc(doc(db, 'placements', id), { ...data, updatedAt: new Date() }, { merge: true }),
    );
  }, []);

  const removePlacement = useCallback(async (id: string) => {
    await withRetry(() => deleteDoc(doc(db, 'placements', id)));
  }, []);

  const updateOwnerMapping = useCallback(async (newMapping: OwnerMapping) => {
    await withRetry(() =>
      setDoc(doc(db, 'metadata', 'account_owners_mapping'), newMapping, { merge: true }),
    );
  }, []);

  const saveSnapshot = useCallback(async (owners: Record<string, OwnerSnapshot>) => {
    if (Object.keys(owners).length === 0) return;
    const monthKey = new Date().toISOString().substring(0, 7);
    const date = new Date().toISOString();
    await withRetry(() =>
      setDoc(doc(db, 'patrimoine_snapshots', monthKey), { monthKey, date, owners }),
    );
  }, []);

  // Dérive le sparkline net-worth de buildWealthTimeline (fill-forward + dédup
  // portefeuille agrégat/positions) pour rester cohérent avec les graphes d'audit.
  const wealthHistory = useMemo(
    () =>
      buildWealthTimeline(placementHistory).map((p) => ({
        date: p.date,
        amount: p.amount,
      })),
    [placementHistory],
  );

  const cleanupDuplicates = useCallback(async () => cleanupHistoryDuplicates(), []);

  const reportHistoryDuplicates = useCallback(async () => reportDuplicates(), []);

  return {
    placements,
    savingsBalances,
    accountBalances,
    portfolioValue,
    placementHistory,
    wealthHistory,
    patrimoineSnapshots,
    snapshotsLoaded,
    ownerMapping,
    totals,
    loading,
    savePlacement,
    removePlacement,
    updateOwnerMapping,
    saveSnapshot,
    cleanupDuplicates,
    reportHistoryDuplicates,
  };
};
