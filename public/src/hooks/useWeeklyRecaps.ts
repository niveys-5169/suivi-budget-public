import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { WeeklyRecap } from '../types/banking.types';

/**
 * Fiches « Ma semaine » enregistrées à chaque email hebdomadaire
 * (collection `weekly_recaps`), de la plus récente à la plus ancienne.
 */
export const useWeeklyRecaps = () => {
  const [recaps, setRecaps] = useState<WeeklyRecap[]>([]);
  // Sans Firestore configuré, rien à charger.
  const [loading, setLoading] = useState(Boolean(db));

  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      collection(db, 'weekly_recaps'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as Omit<WeeklyRecap, 'id'>), id: d.id }));
        list.sort((a, b) => b.id.localeCompare(a.id));
        setRecaps(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useWeeklyRecaps] Erreur écoute weekly_recaps:', err);
        setLoading(false);
      },
    );
  }, []);

  return { recaps, loading };
};
