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
} from 'firebase/firestore';
import { db as dbModular } from '../services/firebase';
import { withRetry } from '../utils/withRetry';
import type { Credit } from '../types/banking.types';

export type AddCreditInput = Omit<Credit, 'id'>;
export type UpdateCreditInput = Partial<AddCreditInput>;

/** CRUD des crédits (capital restant dû, échéancier) avec synchronisation Firestore. */
export function useCredits() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    const q = query(collection(dbModular, 'credits'));

    return onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Credit);
        setCredits(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading credits:', err);
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    // Abonnement Firestore (système externe), aussi relancé par refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const unsub = loadData();
    return () => unsub();
  }, [loadData]);

  const addCredit = async (input: AddCreditInput) => {
    try {
      await addDoc(collection(dbModular, 'credits'), {
        ...input,
        updatedAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      console.error('Error adding credit:', err);
      throw err;
    }
  };

  const updateCredit = async (id: string, input: UpdateCreditInput) => {
    try {
      const docRef = doc(dbModular, 'credits', id);
      await withRetry(() =>
        updateDoc(docRef, {
          ...input,
          updatedAt: serverTimestamp(),
        }),
      );
    } catch (err: unknown) {
      console.error('Error updating credit:', err);
      throw err;
    }
  };

  const deleteCredit = async (id: string) => {
    try {
      const docRef = doc(dbModular, 'credits', id);
      await withRetry(() => deleteDoc(docRef));
    } catch (err: unknown) {
      console.error('Error deleting credit:', err);
      throw err;
    }
  };

  return {
    credits,
    loading,
    error,
    addCredit,
    updateCredit,
    deleteCredit,
    refresh: loadData,
  };
}
