import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  orderBy,
  where,
  limit,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db as dbModular } from '../services/firebase';
import { parseDateInput } from '../utils/date';
import type { PlacementSnapshot } from '../types/patrimoine';
import { withRetry } from '../utils/withRetry';

export type Placement = {
  id: string;
  nom: string;
  owner?: string;
  type: string;
  montant: number;
  commentaire?: string;
  updatedAt?: Timestamp | null;
};

/** Champs legacy tolérés sur d'anciens documents placement. */
export interface LegacyPlacementFields {
  name?: string;
  ownerId?: string;
  balance?: number;
  compte?: string;
  account?: string;
}

export type AddPlacementInput = {
  nom: string;
  owner?: string;
  type: string;
  montant: number;
  commentaire?: string;
};

export type UpdatePlacementInput = Partial<AddPlacementInput>;

function todayKey(): string {
  return new Date().toISOString().split('T')[0]!;
}

async function writeHistoryEntry(
  assetId: string,
  data: { montant: number; type: string; owner?: string },
) {
  const date = todayKey();
  const entryId = `${assetId}_${date}`;
  await withRetry(() =>
    setDoc(
      doc(dbModular, 'placement_history', entryId),
      {
        assetId,
        montant: data.montant,
        date,
        type: data.type,
        owner: data.owner || 'Commun',
        source: 'manual',
      },
      { merge: true },
    ),
  );
}

/** CRUD des placements financiers (épargne, bourse, retraite) avec synchronisation Firestore. */
export function usePlacements() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    const q = query(collection(dbModular, 'placements'));

    return onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Placement);
        setPlacements(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading placements:', err);
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    const unsub = loadData();
    return () => unsub();
  }, [loadData]);

  const addPlacement = async (input: AddPlacementInput) => {
    try {
      const ref = await addDoc(collection(dbModular, 'placements'), {
        ...input,
        updatedAt: serverTimestamp(),
      });
      await writeHistoryEntry(ref.id, {
        montant: input.montant,
        type: input.type,
        owner: input.owner,
      });
    } catch (err: unknown) {
      console.error('Error adding placement:', err);
      throw err;
    }
  };

  const updatePlacement = async (id: string, input: UpdatePlacementInput) => {
    try {
      const docRef = doc(dbModular, 'placements', id);
      await withRetry(() =>
        updateDoc(docRef, {
          ...input,
          updatedAt: serverTimestamp(),
        }),
      );
      if (input.montant !== undefined && input.type !== undefined) {
        await writeHistoryEntry(id, {
          montant: input.montant,
          type: input.type,
          owner: input.owner,
        });
      }
    } catch (err: unknown) {
      console.error('Error updating placement:', err);
      throw err;
    }
  };

  const deletePlacement = async (id: string) => {
    try {
      const docRef = doc(dbModular, 'placements', id);
      await withRetry(() => deleteDoc(docRef));
    } catch (err: unknown) {
      console.error('Error deleting placement:', err);
      throw err;
    }
  };

  return {
    placements,
    loading,
    error,
    addPlacement,
    updatePlacement,
    deletePlacement,
    refresh: loadData,
    getLastPlacementSnapshot,
  };
}

export async function getLastPlacementSnapshot(
  placementId: string,
): Promise<PlacementSnapshot | null> {
  try {
    const historyRef = collection(dbModular, 'placement_history');
    const q = query(
      historyRef,
      where('assetId', '==', placementId),
      orderBy('date', 'desc'),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0]!;
    const data = docSnap.data();

    return {
      montant: data.montant,
      date: parseDateInput(data.date) || new Date(),
    };
  } catch (err) {
    console.error('Error fetching placement history:', err);
    return null;
  }
}
