import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, FIREBASE_CONFIG } from '../services/firebase';
import { ensureUserPreferencesExist } from '../services/firestoreMigrations';
import { getAISettings } from '../services/firebase-api';
import { writeAISettings } from '../utils/aiConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // E2E smoke runs without Firebase credentials. Resolve the public shell as
    // a signed-out visitor instead of waiting indefinitely for Firebase Auth.
    if (import.meta.env.VITE_E2E === 'true') {
      // Mode E2E sans Firebase : l'état d'auth est résolu d'emblée (synchro externe).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (nextUser) => {
        if (
          nextUser &&
          FIREBASE_CONFIG.authorizedEmail &&
          nextUser.email !== FIREBASE_CONFIG.authorizedEmail
        ) {
          setError('Compte non autorisé pour cette application.');
          await firebaseSignOut(auth);
          setUser(null);
        } else {
          setError(null);
          setUser(nextUser);
          if (nextUser) {
            await ensureUserPreferencesExist(nextUser.uid);
            // Firestore fait foi : on remplace les réglages IA locaux.
            const remoteAI = await getAISettings();
            if (remoteAI) writeAISettings(remoteAI);
          }
        }
        setLoading(false);
      },
      (authError) => {
        setError(authError.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, loading, error }}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
