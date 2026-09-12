// src/hooks/usePortfolioAuth.ts
import { useState, useCallback, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { authPortfolio } from '../services/firebase';

/**
 * Hook managing Firebase authentication for the portfolio module.
 * Returns the current user, any error, and a login function.
 */
export const usePortfolioAuth = () => {
  const [user, setUser] = useState<User | null>(authPortfolio.currentUser);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(authPortfolio, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Handle redirect result (e.g., when popup blocked)
  useEffect(() => {
    getRedirectResult(authPortfolio)
      .then((result) => {
        if (result?.user) setUser(result.user);
      })
      .catch(() => {
        // No pending redirect result — ignore
      });
  }, []);

  /**
   * Attempts to sign in with Google via popup.
   * Falls back to redirect if popup is blocked (common in standalone PWA).
   * @returns Promise resolving to the signed-in user or null if redirect pending.
   */
  const login = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      const r = await signInWithPopup(authPortfolio, provider);
      setUser(r.user);
      return r.user;
    } catch (err) {
      const authErr = err as { code?: string; message: string };
      // Fallback to redirect when the popup is blocked (common in standalone PWA on iOS/Android).
      if (authErr?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(authPortfolio, new GoogleAuthProvider());
          return null; // Result handled by getRedirectResult on next load.
        } catch (redirectErr) {
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

  return { user, error, login };
};
