import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { withRetry } from '../utils/withRetry';

export type TransactionsViewMode = 'hightech' | 'fintech';
export type Density = 'comfortable' | 'compact';

export interface UsePreferencesResult {
  dashboardCategories: string[];
  setDashboardCategories: (categories: string[]) => void;
  transactionsViewMode: TransactionsViewMode;
  setTransactionsViewMode: (mode: TransactionsViewMode) => void;
  privacyMode: boolean;
  setPrivacyMode: (fn: (v: boolean) => boolean) => void;
  density: Density;
  setDensity: (density: Density) => void;
  /** Active la nouvelle interface (design JourX). L'ancien design reste le défaut. */
  loading: boolean;
  error: string | null;
  isSyncing: boolean;
}

const getStorageKey = (uid: string | null | undefined, key: string) =>
  uid ? `${key}_${uid}` : null;

const getFromStorage = <T,>(key: string | null, defaultValue: T): T => {
  if (!key) return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
};

const saveToStorage = <T,>(key: string | null, value: T) => {
  if (key) localStorage.setItem(key, JSON.stringify(value));
};

/** Persiste les préférences UI (catégories dashboard, densité, mode vue) dans Firestore et localStorage. */
export const usePreferences = (): UsePreferencesResult => {
  const { user } = useAuth();
  const [dashboardCategories, setDashboardCategories] = useState<string[]>([]);
  const [transactionsViewMode, setTransactionsViewMode] =
    useState<TransactionsViewMode>('hightech');
  const [privacyMode, setPrivacyModeState] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('dashboard_privacy_mode') ?? 'false');
    } catch {
      return false;
    }
  });
  const [density, setDensityState] = useState<Density>(() => {
    try {
      const raw = localStorage.getItem('ui_density');
      return raw === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const categoriesKey = getStorageKey(user?.uid, 'dashboard_categories');
  const viewModeKey = getStorageKey(user?.uid, 'transactions_view_mode');

  // Load from Firestore with localStorage fallback
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        setLoading(true);
        const preferenceRef = doc(db, 'users', user.uid, 'preferences', 'ui');
        const docSnap = await getDoc(preferenceRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const categories = data.categories || [];
          const viewMode = data.transactionsViewMode || 'hightech';
          const remoteDensity: Density = data.density === 'compact' ? 'compact' : 'comfortable';

          setDashboardCategories(categories);
          setTransactionsViewMode(viewMode);
          setDensityState(remoteDensity);

          saveToStorage(categoriesKey, categories);
          saveToStorage(viewModeKey, viewMode);
          localStorage.setItem('ui_density', remoteDensity);
        } else {
          setDashboardCategories(getFromStorage(categoriesKey, []));
          setTransactionsViewMode(getFromStorage(viewModeKey, 'hightech'));
        }

        setError(null);

        // Subscribe to real-time updates
        unsubscribeRef.current = onSnapshot(preferenceRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const categories = data.categories || [];
            const viewMode = data.transactionsViewMode || 'hightech';
            const remoteDensity: Density = data.density === 'compact' ? 'compact' : 'comfortable';

            setDashboardCategories(categories);
            setTransactionsViewMode(viewMode);
            setDensityState(remoteDensity);

            saveToStorage(categoriesKey, categories);
            saveToStorage(viewModeKey, viewMode);
            localStorage.setItem('ui_density', remoteDensity);
          }
        });

        setLoading(false);
      } catch (err) {
        console.error('>>> usePreferences: Failed to load from Firestore:', err);
        setDashboardCategories(getFromStorage(categoriesKey, []));
        setTransactionsViewMode(getFromStorage(viewModeKey, 'hightech'));
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
        setLoading(false);
      }
    };

    loadPreferences();

    return () => unsubscribeRef.current?.();
  }, [user, categoriesKey, viewModeKey]);

  const syncPreferences = useCallback(
    async (categories: string[], viewMode: TransactionsViewMode) => {
      if (!user) return;

      setIsSyncing(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const preferenceRef = doc(db, 'users', user.uid, 'preferences', 'ui');
          await withRetry(() =>
            setDoc(
              preferenceRef,
              {
                categories,
                transactionsViewMode: viewMode,
              },
              { merge: true },
            ),
          );
          setError(null);
        } catch (err) {
          console.error('>>> usePreferences: Failed to save to Firestore:', err);
          setError(err instanceof Error ? err.message : 'Failed to save preferences');
        } finally {
          setIsSyncing(false);
        }
      }, 500);
    },
    [user],
  );

  const handleSetCategories = useCallback(
    (newCategories: string[]) => {
      setDashboardCategories(newCategories);
      saveToStorage(categoriesKey, newCategories);
      syncPreferences(newCategories, transactionsViewMode);
    },
    [categoriesKey, syncPreferences, transactionsViewMode],
  );

  const handleSetViewMode = useCallback(
    (newMode: TransactionsViewMode) => {
      setTransactionsViewMode(newMode);
      saveToStorage(viewModeKey, newMode);
      syncPreferences(dashboardCategories, newMode);
    },
    [viewModeKey, syncPreferences, dashboardCategories],
  );

  // Retry writes when coming online
  useEffect(() => {
    if (!user) return;

    const handleOnline = async () => {
      try {
        setIsSyncing(true);
        const preferenceRef = doc(db, 'users', user.uid, 'preferences', 'ui');
        await withRetry(() =>
          setDoc(
            preferenceRef,
            {
              categories: dashboardCategories,
              transactionsViewMode,
            },
            { merge: true },
          ),
        );
        setError(null);
      } catch (err) {
        console.error('>>> usePreferences: Failed to sync on online:', err);
        setError(err instanceof Error ? err.message : 'Failed to sync preferences');
      } finally {
        setIsSyncing(false);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, dashboardCategories, transactionsViewMode]);

  useEffect(() => () => clearTimeout(debounceTimerRef.current), []);

  useEffect(() => {
    localStorage.setItem('dashboard_privacy_mode', JSON.stringify(privacyMode));
  }, [privacyMode]);

  const handleSetPrivacyMode = useCallback((fn: (v: boolean) => boolean) => {
    setPrivacyModeState((v) => fn(v));
  }, []);

  const handleSetDensity = useCallback(
    (next: Density) => {
      setDensityState(next);
      localStorage.setItem('ui_density', next);
      // Broadcast to listeners outside the React tree (e.g. <html> attribute applier in MainApp).
      window.dispatchEvent(new CustomEvent('density-change', { detail: { density: next } }));

      // Fire-and-forget Firestore sync; failure falls back to local persistence.
      if (user) {
        const preferenceRef = doc(db, 'users', user.uid, 'preferences', 'ui');
        setDoc(preferenceRef, { density: next }, { merge: true }).catch((err) => {
          console.error('>>> usePreferences: Failed to save density:', err);
        });
      }
    },
    [user],
  );

  return {
    dashboardCategories,
    setDashboardCategories: handleSetCategories,
    transactionsViewMode,
    setTransactionsViewMode: handleSetViewMode,
    privacyMode,
    setPrivacyMode: handleSetPrivacyMode,
    density,
    setDensity: handleSetDensity,
    loading,
    error,
    isSyncing,
  };
};
