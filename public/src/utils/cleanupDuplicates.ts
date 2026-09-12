import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toMillis } from './firestoreDate';
import type { FirestoreDateLike } from '../types/banking.types';
import { withRetry } from './withRetry';

export interface DuplicateGroup {
  key: string; // assetId|date
  entries: Array<{
    id: string;
    date: string;
    montant: number;
    createdAt?: FirestoreDateLike;
  }>;
}

/**
 * Analyzes placement_history for duplicates (same assetId + date)
 */
export async function analyzeHistoryDuplicates(): Promise<DuplicateGroup[]> {
  const snapshot = await getDocs(collection(db, 'placement_history'));
  const grouped = new Map<string, DuplicateGroup['entries']>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const key = `${data.assetId}|${data.date}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push({
      id: doc.id,
      date: data.date,
      montant: data.montant,
      createdAt: data.createdAt,
    });
  });

  // Return only groups with duplicates (2+)
  const duplicates: DuplicateGroup[] = [];
  grouped.forEach((entries, key) => {
    if (entries.length > 1) {
      duplicates.push({
        key,
        entries: entries.sort((a, b) => {
          const timeA = toMillis(a.createdAt);
          const timeB = toMillis(b.createdAt);
          return timeB - timeA; // newest first
        }),
      });
    }
  });

  return duplicates;
}

/**
 * Removes duplicate entries, keeping the newest one and summing older values into it
 * Strategy: Keep the newest entry with accumulated montant from all duplicates
 */
export async function cleanupHistoryDuplicates(): Promise<{
  removed: number;
  updated: number;
  duplicateGroups: DuplicateGroup[];
}> {
  const duplicates = await analyzeHistoryDuplicates();

  if (duplicates.length === 0) {
    return { removed: 0, updated: 0, duplicateGroups: [] };
  }

  const batch = writeBatch(db);
  let removed = 0;
  let updated = 0;

  duplicates.forEach((group) => {
    const [newest, ...oldEntries] = group.entries;
    if (!newest) return;

    // Sum all montants
    const totalMontant = group.entries.reduce((sum, e) => sum + e.montant, 0);

    // Update newest with total
    if (totalMontant !== newest.montant) {
      batch.update(doc(db, 'placement_history', newest.id), {
        montant: totalMontant,
        updatedAt: new Date(),
        mergedFrom: oldEntries.map((e) => e.id),
      });
      updated++;
    }

    // Delete old entries
    oldEntries.forEach((entry) => {
      batch.delete(doc(db, 'placement_history', entry.id));
      removed++;
    });
  });

  await withRetry(() => batch.commit());

  console.log(`✅ Cleanup complete: ${removed} removed, ${updated} updated`);
  return { removed, updated, duplicateGroups: duplicates };
}

/**
 * Logs duplicate analysis without making changes
 */
export async function reportDuplicates(): Promise<void> {
  const duplicates = await analyzeHistoryDuplicates();

  if (duplicates.length === 0) {
    console.log('✅ No duplicates found');
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate groups:\n`);
  duplicates.forEach((group) => {
    console.log(`📌 ${group.key}`);
    group.entries.forEach((e, i) => {
      console.log(
        `   ${i === 0 ? '🔴 KEEP' : '🗑️  DELETE'} [${e.id}] montant=${e.montant}, date=${e.date}`,
      );
    });
    console.log('');
  });
}
