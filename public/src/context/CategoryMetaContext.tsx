import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  type CategoryMeta,
  setCategoryOverrides,
  getCategoryMeta,
} from '../constants/categoryMetadata';
import { withRetry } from '../utils/withRetry';

interface CategoryMetaContextValue {
  /** Surcharges utilisateur courantes (catégorie → icône/couleur). */
  overrides: Record<string, CategoryMeta>;
  /** Définit/écrase l'icône+couleur d'une catégorie (persisté Firestore). */
  setMeta: (categorie: string, meta: CategoryMeta) => Promise<void>;
  /** Supprime la surcharge d'une catégorie (revient à l'intégrée ou au repli). */
  resetMeta: (categorie: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const CategoryMetaContext = createContext<CategoryMetaContextValue | null>(null);

const PREF_DOC = (uid: string) => doc(db, 'users', uid, 'preferences', 'categoryMeta');

/**
 * Charge les surcharges d'icônes/couleurs de catégories depuis
 * `users/{uid}/preferences/categoryMeta` (onSnapshot), les pousse dans le store module
 * (`setCategoryOverrides`) pour que `getCategoryMeta` les voie partout, et re-rend son
 * sous-arbre à chaque changement afin que les icônes se rafraîchissent dans toute l'app.
 */
export const CategoryMetaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [overrides, setOverridesState] = useState<Record<string, CategoryMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) {
      setCategoryOverrides({});
      setOverridesState({});
      setLoading(false);
      return;
    }

    setLoading(true);
    unsubRef.current = onSnapshot(
      PREF_DOC(user.uid),
      (snap) => {
        const map = (snap.exists() ? snap.data()?.meta : null) as
          Record<string, CategoryMeta> | undefined;
        const next = map ?? {};
        setCategoryOverrides(next);
        setOverridesState(next);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('>>> CategoryMetaProvider: snapshot error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubRef.current?.();
  }, [user]);

  const setMeta = useCallback(
    async (categorie: string, meta: CategoryMeta) => {
      if (!user) return;
      try {
        await withRetry(() =>
          setDoc(PREF_DOC(user.uid), { meta: { [categorie]: meta } }, { merge: true }),
        );
      } catch (err) {
        console.error('>>> CategoryMetaProvider: setMeta failed:', err);
        setError(err instanceof Error ? err.message : 'Échec de sauvegarde');
        throw err;
      }
    },
    [user],
  );

  const resetMeta = useCallback(
    async (categorie: string) => {
      if (!user) return;
      try {
        await withRetry(() =>
          updateDoc(PREF_DOC(user.uid), { [`meta.${categorie}`]: deleteField() }),
        );
      } catch (err) {
        console.error('>>> CategoryMetaProvider: resetMeta failed:', err);
        setError(err instanceof Error ? err.message : 'Échec de réinitialisation');
        throw err;
      }
    },
    [user],
  );

  return (
    <CategoryMetaContext.Provider value={{ overrides, setMeta, resetMeta, loading, error }}>
      {children}
    </CategoryMetaContext.Provider>
  );
};

/** Accès aux surcharges + mutateurs. `getMeta` reste le résolveur global synchrone. */
export const useCategoryMeta = (): CategoryMetaContextValue & {
  getMeta: typeof getCategoryMeta;
} => {
  const ctx = useContext(CategoryMetaContext);
  if (!ctx) {
    throw new Error('useCategoryMeta doit être utilisé dans un CategoryMetaProvider');
  }
  return { ...ctx, getMeta: getCategoryMeta };
};
