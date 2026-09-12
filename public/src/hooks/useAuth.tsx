import { useCallback } from 'react';
import {
  type Auth,
  type User,
  signInWithRedirect,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider, FIREBASE_CONFIG } from '../services/firebase';
import { ensureUserPreferencesExist } from '../services/firestoreMigrations';
import { useAuthContext } from '../context/AuthContext';

type UseAuthResult = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

/** Retourne l'utilisateur Firebase connecté depuis AuthContext. */
export function useAuth(): UseAuthResult {
  const { user, loading, error } = useAuthContext();

  const signIn = useCallback(async () => {
    // ... logic remains same but without setLoading ...
    const attemptPopupSignIn = async (targetAuth: Auth) => {
      const result = await signInWithPopup(targetAuth, googleProvider);
      if (
        FIREBASE_CONFIG.authorizedEmail &&
        result.user.email !== FIREBASE_CONFIG.authorizedEmail
      ) {
        await firebaseSignOut(targetAuth);
        throw new Error('Compte non autorisé pour cette application.');
      }
      await ensureUserPreferencesExist(result.user.uid);
    };

    try {
      await attemptPopupSignIn(auth);
    } catch (err) {
      const isPopupBlocked =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'auth/popup-blocked';

      if (isPopupBlocked) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
  };
}
