import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { dbPortfolio, authPortfolio, db, functions } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  buildPerHoldingDailySnapshots,
  holdingAssetId,
  type PortfolioTx,
  type PriceHistory,
} from '../utils/portfolioReconstruction';
import { toMillis } from '../utils/firestoreDate';
import { withRetry } from '../utils/withRetry';

export interface Holding {
  docId: string;
  isin: string;
  name: string;
  ticker: string;
  quantity: number;
  avgPrice: number;
  totalCost: number;
  currentValue: number;
  lastPrice: number;
  account: string;
  owner: string;
  currency: string;
  unrealizedGain: number;
  unrealizedGainPct: number;
  updatedAt: Timestamp | null;
}

interface Instrument {
  name?: string;
  short_name?: string;
  ticker?: string;
  last_price?: number;
  currency?: string;
  updated_at?: Timestamp | null;
}

function portfolioHoldingScore(h: Holding) {
  return [
    toMillis(h.updatedAt),
    h.docId !== h.isin ? 1 : 0,
    Number(h.currentValue) || 0,
    Number(h.quantity) || 0,
  ];
}

function isBetterPortfolioHolding(candidate: Holding, current: Holding) {
  const candidateScore = portfolioHoldingScore(candidate);
  const currentScore = portfolioHoldingScore(current);
  for (let i = 0; i < candidateScore.length; i++) {
    if (candidateScore[i]! !== currentScore[i]!) return candidateScore[i]! > currentScore[i]!;
  }
  return false;
}

/** Convertit un doc Firestore de transaction portefeuille en PortfolioTx. */
function mapPortfolioTxDoc(data: Record<string, unknown>): PortfolioTx {
  const dateRaw = data.date as { toDate?: () => Date } | string | undefined;
  return {
    type: String(data.type || data.transaction_type || ''),
    date:
      dateRaw instanceof Object && typeof dateRaw.toDate === 'function'
        ? dateRaw.toDate().toISOString().split('T')[0]!
        : String(dateRaw || data.transaction_date || '').split('T')[0]!,
    quantity: (data.quantity ?? data.qty ?? 0) as number | string,
    amount: (data.amount ?? data.total ?? data.price_total ?? 0) as number | string,
    fees: (data.fees ?? data.commission ?? 0) as number | string,
    isin: String(data.isin || data.instrument_id || ''),
    ownerKey: String(data.ownerKey || data.owner_key || data.owner || ''),
    envelope: String(data.envelope || data.account || data.envelope_type || ''),
  };
}

/** Agrège le portefeuille boursier live (cours, P&L, répartition) depuis l'API Tronity. */
export const usePortfolio = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<PortfolioTx[] | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ written: number; skipped: number } | null>(
    null,
  );
  const [user, setUser] = useState<User | null>(authPortfolio.currentUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(authPortfolio, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Handle the result of a redirect-based portfolio login (e.g. when popup was blocked in PWA).
  useEffect(() => {
    getRedirectResult(authPortfolio)
      .then((result) => {
        if (result?.user) setUser(result.user);
      })
      .catch(() => {
        // No pending redirect result — ignore.
      });
  }, []);

  const login = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const r = await signInWithPopup(authPortfolio, provider);
      setUser(r.user);
      return r.user;
    } catch (err: unknown) {
      const authErr = err as { code?: string; message: string };
      // Fallback to redirect when the popup is blocked (common in standalone PWA on iOS/Android).
      if (authErr?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(authPortfolio, new GoogleAuthProvider());
          return null; // Result handled by getRedirectResult on next load.
        } catch (redirectErr: unknown) {
          const rErr = redirectErr as Error;
          console.error('[Portfolio Auth] Redirect failed:', rErr);
          setError(rErr.message);
          return null;
        }
      }
      console.error('[Portfolio Auth] Login failed:', err);
      setError(authErr.message);
      return null;
    }
  }, []);

  const fetchPortfolio = useCallback(async (u: User) => {
    setLoading(true);
    setError(null);
    try {
      const [holdingsSnap, instrumentsSnap] = await Promise.all([
        getDocs(collection(dbPortfolio, `users/${u.uid}/holdings`)),
        getDocs(collection(dbPortfolio, `users/${u.uid}/instruments`)),
      ]);

      const instruments: Record<string, Instrument> = {};
      instrumentsSnap.docs.forEach((d) => {
        instruments[d.id] = d.data() as Instrument;
      });

      const rawHoldings: Holding[] = holdingsSnap.docs.map((d) => {
        const h = d.data();
        const isin = h.isin || d.id;
        const inst = instruments[isin] || instruments[d.id] || {};
        const qty = Number(h.quantity) || 0;
        const curVal = Number(h.current_value) || Number(h.currentValue) || 0;
        const totalCost =
          Number(h.total_invested) || Number(h.total_cost) || Number(h.totalCost) || 0;
        const unrealizedGain = Number(h.unrealized_gain) || curVal - totalCost;

        return {
          docId: d.id,
          isin,
          name: inst.name || inst.short_name || h.name || isin,
          ticker: inst.ticker || h.ticker || '',
          quantity: qty,
          avgPrice:
            Number(h.avg_buy_price) ||
            Number(h.avg_price) ||
            Number(h.avgPrice) ||
            (qty > 0 ? totalCost / qty : 0),
          totalCost,
          currentValue: curVal,
          lastPrice:
            Number(inst.last_price) ||
            Number(h.last_price) ||
            Number(h.lastPrice) ||
            (qty > 0 ? curVal / qty : 0),
          account: h.envelope || h.account || '',
          owner: h.owner || '',
          currency: h.currency || inst.currency || 'EUR',
          unrealizedGain,
          unrealizedGainPct:
            Number(h.unrealized_gain_pct) ||
            (totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0),
          updatedAt: h.last_updated || h.updated_at || h.updatedAt || inst.updated_at || null,
        };
      });

      const deduped = new Map<string, Holding>();
      rawHoldings.forEach((h) => {
        // Même fallback owner que holdingAssetId : un doc avec owner vide et son
        // équivalent owner='nicolas' sont la même détention (sinon doublon affiché).
        const key = `${h.isin}_${h.account}_${h.owner || 'nicolas'}`.toLowerCase();
        const existing = deduped.get(key);
        if (!existing || isBetterPortfolioHolding(h, existing)) {
          deduped.set(key, h);
        }
      });

      const finalHoldings = Array.from(deduped.values());
      setHoldings(finalHoldings);

      const totalValue = finalHoldings.reduce((s, h) => s + h.currentValue, 0);

      // Historise la valeur ACTUELLE réelle par position pour aujourd'hui, afin
      // que la courbe quotidienne reflète les cours à jour (le snapshot serveur
      // ne fait qu'un carry-forward et n'a pas accès au projet portefeuille).
      // docId {assetId}_{today} + merge → idempotent, écrase avec la dernière valeur intraday.
      try {
        const today = new Date().toISOString().split('T')[0]!;
        const historyBatch = writeBatch(db);
        let historyCount = 0;
        finalHoldings.forEach((h) => {
          if (!h.isin || !(Number(h.currentValue) > 0)) return;
          const assetId = holdingAssetId(h.isin, h.owner || 'nicolas', h.account || 'default');
          historyBatch.set(
            doc(db, 'placement_history', `${assetId}_${today}`),
            {
              assetId,
              nom: h.name,
              date: today,
              montant: Number(h.currentValue) || 0,
              netInvested: Number(h.totalCost) || 0,
              type: 'portefeuille',
              owner: h.owner || 'Nicolas',
              envelope: h.account || '',
              isin: h.isin,
              source: 'live_sync',
              snapshotAt: serverTimestamp(),
            },
            { merge: true },
          );
          historyCount++;
        });
        if (historyCount > 0) await withRetry(() => historyBatch.commit());
      } catch (histErr) {
        console.error('[Portfolio] Failed to historise per-holding values:', histErr);
      }

      // Sync back to budget metadata for fallback
      try {
        await withRetry(() =>
          setDoc(
            doc(db, 'metadata', 'patrimoine_settings'),
            {
              portfolioValue: totalValue,
              portfolioSyncedAt: serverTimestamp(),
              // Permet à la synchro serveur quotidienne de lire le bon compte portefeuille.
              portfolioUid: u.uid,
            },
            { merge: true },
          ),
        );

        // Trigger global patrimony snapshot to update historical graphs
        try {
          const triggerSnapshot = httpsCallable(functions, 'trigger_patrimoine_snapshot');
          await triggerSnapshot();
        } catch (snapshotErr) {
          console.error('[Portfolio] Failed to trigger patrimony snapshot:', snapshotErr);
        }
      } catch (_) {}
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Portfolio] Fetch failed:', err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Charge (une fois, avec cache) les transactions du portefeuille pour la
   * consultation par position. Retourne null si non connecté ou en erreur.
   */
  const fetchTransactions = useCallback(async (): Promise<PortfolioTx[] | null> => {
    if (!user) return null;
    if (transactions) return transactions;
    setTxLoading(true);
    try {
      const txSnap = await getDocs(collection(dbPortfolio, `users/${user.uid}/transactions`));
      const txs = txSnap.docs
        .map((d) => mapPortfolioTxDoc(d.data()))
        .filter((tx) => tx.date && tx.type);
      setTransactions(txs);
      return txs;
    } catch (err: unknown) {
      console.error('[Portfolio] Transactions fetch failed:', err);
      return null;
    } finally {
      setTxLoading(false);
    }
  }, [user, transactions]);

  /**
   * Fetches transactions + historical prices from the portfolio Firestore,
   * reconstructs monthly values per (isin, owner, envelope) triplet,
   * and writes missing entries to placement_history.
   * Deletes legacy portfolio_bkfill_* aggregate entries for covered months.
   */
  const backfillPortfolioHistory = useCallback(async (u: User) => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      // Step 1 — fetch transactions
      const txSnap = await getDocs(collection(dbPortfolio, `users/${u.uid}/transactions`));

      const transactions: PortfolioTx[] = txSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            type: data.type || data.transaction_type || '',
            date:
              data.date instanceof Object && typeof data.date.toDate === 'function'
                ? data.date.toDate().toISOString().split('T')[0]
                : String(data.date || data.transaction_date || '').split('T')[0],
            quantity: data.quantity ?? data.qty ?? 0,
            amount: data.amount ?? data.total ?? data.price_total ?? 0,
            fees: data.fees ?? data.commission ?? 0,
            isin: data.isin || data.instrument_id || '',
            ownerKey: data.ownerKey || data.owner_key || data.owner || '',
            envelope: data.envelope || data.account || data.envelope_type || '',
          };
        })
        .filter((tx) => tx.date && tx.type);

      if (!transactions.length) {
        setBackfillResult({ written: 0, skipped: 0 });
        return;
      }

      // Step 2 — fetch historical prices + instrument names for every unique ISIN
      const uniqueIsins = [
        ...new Set(transactions.map((tx) => (tx.isin || '').toUpperCase()).filter(Boolean)),
      ];

      const priceHistory: PriceHistory = {};
      const instrumentNames: Record<string, string> = {};

      await Promise.all(
        uniqueIsins.map(async (isin) => {
          try {
            const isinKey = isin.toLowerCase();
            const [pricesSnap, instSnap] = await Promise.all([
              getDocs(collection(dbPortfolio, `users/${u.uid}/instruments/${isin}/prices`)),
              getDoc(doc(dbPortfolio, `users/${u.uid}/instruments/${isin}`)),
            ]);
            priceHistory[isinKey] = {};
            pricesSnap.docs.forEach((d) => {
              const nav = Number(d.data().nav || 0);
              if (nav > 0) priceHistory[isinKey]![d.id] = nav;
            });
            if (instSnap.exists()) {
              const data = instSnap.data();
              instrumentNames[isinKey] = data.name || data.short_name || isin;
            }
          } catch {
            // Instrument inconnu ou sans historique
          }
        }),
      );

      // Step 3 — build per-holding daily snapshots (points only on value changes)
      const holdingSnapshots = buildPerHoldingDailySnapshots(
        transactions,
        priceHistory,
        instrumentNames,
      );

      // Step 4 — write per-holding entries, skip if (assetId, date) already exists
      let written = 0;
      let skipped = 0;
      const BATCH_SIZE = 400;

      for (let i = 0; i < holdingSnapshots.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = holdingSnapshots.slice(i, i + BATCH_SIZE);

        await Promise.all(
          chunk.map(async (snap) => {
            const docId = `${snap.assetId}_${snap.date}`;
            const docRef = doc(db, 'placement_history', docId);
            const existing = await getDoc(docRef);
            if (existing.exists()) {
              skipped++;
              return;
            }
            batch.set(docRef, {
              assetId: snap.assetId,
              nom: snap.nom,
              date: snap.date,
              montant: snap.montant,
              netInvested: snap.netInvested,
              type: 'portefeuille',
              owner: snap.owner,
              envelope: snap.envelope,
              isin: snap.isin,
              source: 'backfill',
            });
            written++;
          }),
        );

        await withRetry(() => batch.commit());
      }

      // Step 5 — delete legacy portfolio_global aggregate entries for covered months
      // to avoid double-counting in the wealth timeline
      const coveredMonths = [...new Set(holdingSnapshots.map((s) => s.monthKey))];
      const deleteChunkSize = 490;
      for (let i = 0; i < coveredMonths.length; i += deleteChunkSize) {
        const deleteBatch = writeBatch(db);
        let hasDeletes = false;
        await Promise.all(
          coveredMonths.slice(i, i + deleteChunkSize).map(async (monthKey) => {
            const oldRef = doc(db, 'placement_history', `portfolio_bkfill_${monthKey}`);
            const oldDoc = await getDoc(oldRef);
            if (oldDoc.exists()) {
              deleteBatch.delete(oldRef);
              hasDeletes = true;
            }
          }),
        );
        if (hasDeletes) await withRetry(() => deleteBatch.commit());
      }

      setBackfillResult({ written, skipped });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Portfolio Backfill] Failed:', err);
      setError(errorMsg);
    } finally {
      setBackfilling(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Chargement Firestore (système externe), fetchPortfolio sert aussi au refresh.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchPortfolio(user);
    }
  }, [user, fetchPortfolio]);

  const totalValue = useMemo(() => holdings.reduce((s, h) => s + h.currentValue, 0), [holdings]);

  return {
    holdings,
    totalValue,
    loading,
    backfilling,
    backfillResult,
    transactions,
    txLoading,
    fetchTransactions,
    user,
    error,
    login,
    refresh: () => user && fetchPortfolio(user),
    backfillHistory: () => user && backfillPortfolioHistory(user),
  };
};
