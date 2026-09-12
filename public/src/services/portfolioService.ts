// src/services/portfolioService.ts
// Service layer for portfolio-related Firestore operations and business logic

import { dbPortfolio, db, functions } from '../services/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { DocumentData, Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { withRetry } from '../utils/withRetry';
import {
  buildPerHoldingDailySnapshots,
  holdingAssetId,
  type PortfolioTx,
  type PriceHistory,
} from '../utils/portfolioReconstruction';

// Define local interfaces to avoid circular dependency issues
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

/**
 * Fetch holdings for the given user ID.
 * @param uid - Firebase user UID
 * @returns Promise holding array
 */
export async function getHoldings(uid: string): Promise<Holding[]> {
  const holdingsSnap = await getDocs(collection(dbPortfolio, `users/${uid}/holdings`));
  const instrumentsSnap = await getDocs(collection(dbPortfolio, `users/${uid}/instruments`));

  const instruments: Record<string, DocumentData> = {};
  instrumentsSnap.docs.forEach((d) => {
    instruments[d.id] = d.data();
  });

  const rawHoldings: Holding[] = holdingsSnap.docs.map((d) => {
    const h = d.data();
    const isin = h.isin || d.id;
    const inst = instruments[isin] || instruments[d.id] || {};
    const qty = Number(h.quantity) || 0;
    const curVal = Number(h.current_value) || Number(h.currentValue) || 0;
    const totalCost = Number(h.total_invested) || Number(h.total_cost) || Number(h.totalCost) || 0;
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
        Number(h.unrealized_gain_pct) || (totalCost > 0 ? (unrealizedGain / totalCost) * 100 : 0),
      updatedAt: h.last_updated || h.updated_at || h.updatedAt || inst.updated_at || null,
    };
  });

  // Deduplication logic (same as in usePortfolio)
  const deduped = new Map<string, Holding>();
  rawHoldings.forEach((h) => {
    const key = `${h.isin}_${h.account}_${h.owner || 'nicolas'}`.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || isBetterPortfolioHolding(h, existing)) {
      deduped.set(key, h);
    }
  });

  return Array.from(deduped.values());
}

/**
 * Helper to compare two holdings for deduplication (same as in usePortfolio).
 */
function portfolioHoldingScore(h: Holding): number[] {
  return [
    h.updatedAt ? h.updatedAt.toMillis() : 0,
    h.docId !== h.isin ? 1 : 0,
    Number(h.currentValue) || 0,
    Number(h.quantity) || 0,
  ];
}
function isBetterPortfolioHolding(candidate: Holding, current: Holding): boolean {
  const candidateScore = portfolioHoldingScore(candidate);
  const currentScore = portfolioHoldingScore(current);
  for (let i = 0; i < candidateScore.length; i++) {
    if (candidateScore[i]! !== currentScore[i]!) return candidateScore[i]! > currentScore[i]!;
  }
  return false;
}

/**
 * Fetch transactions for the given user ID.
 * @param uid - Firebase user UID
 * @returns Promise holding array of PortfolioTx
 */
export async function getTransactions(uid: string): Promise<PortfolioTx[]> {
  const txSnap = await getDocs(collection(dbPortfolio, `users/${uid}/transactions`));
  return txSnap.docs
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
}

/**
 * Write per‑holding daily snapshots to placement_history collection.
 * @param db - Firestore instance
 * @param holdings - Array of holdings to snapshot
 */
export async function writeHistorySnapshots(db: Firestore, holdings: Holding[]): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const historyBatch = writeBatch(db);
    let historyCount = 0;
    holdings.forEach((h) => {
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
    console.error('[PortfolioService] Failed to historise per-holding values:', histErr);
  }
}

/**
 * Update portfolio metadata in Firestore (value, sync time, UID).
 * @param uid - Firebase user UID
 * @param totalValue - Current total portfolio value
 */
export async function updateMetadata(uid: string, totalValue: number): Promise<void> {
  try {
    await withRetry(() =>
      setDoc(
        doc(db, 'metadata', 'patrimoine_settings'),
        {
          portfolioValue: totalValue,
          portfolioSyncedAt: serverTimestamp(),
          portfolioUid: uid,
        },
        { merge: true },
      ),
    );
  } catch (e) {
    console.error('[PortfolioService] Failed to update metadata:', e);
  }
}

/**
 * Trigger the patrimoine snapshot Cloud Function.
 */
export async function triggerPatrimoineSnapshot(): Promise<void> {
  try {
    const triggerSnapshot = httpsCallable(functions, 'trigger_patrimoine_snapshot');
    await triggerSnapshot();
  } catch (snapshotErr) {
    console.error('[PortfolioService] Failed to trigger patrimony snapshot:', snapshotErr);
  }
}

/**
 * Backfill portfolio history from transactions (replicates usePortfolio backfillPortfolioHistory).
 * @param uid - Firebase user UID
 * @returns Promise resolving to { written: number; skipped: number }
 */
export async function backfillPortfolioHistory(
  uid: string,
): Promise<{ written: number; skipped: number }> {
  let written = 0;
  let skipped = 0;

  // Step 1 — fetch transactions
  const txSnap = await getDocs(collection(dbPortfolio, `users/${uid}/transactions`));
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
    return { written: 0, skipped: 0 };
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
          getDocs(collection(dbPortfolio, `users/${uid}/instruments/${isin}/prices`)),
          getDoc(doc(dbPortfolio, `users/${uid}/instruments/${isin}`)),
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

  // Step 4 — write per‑holding entries, skip if (assetId, date) already exists
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

  return { written, skipped };
}

// Helper function holdingAssetId (copy from utils/portfolioReconstruction.ts)
// Removed duplicate; using imported version from '../utils/portfolioReconstruction'
