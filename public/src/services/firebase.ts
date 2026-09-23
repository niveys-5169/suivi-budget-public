import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  authorizedEmail: '' as string | undefined,
};

export const PORTFOLIO_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_PORTFOLIO_API_KEY,
  authDomain: import.meta.env.VITE_PORTFOLIO_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PORTFOLIO_PROJECT_ID,
  storageBucket: import.meta.env.VITE_PORTFOLIO_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_PORTFOLIO_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_PORTFOLIO_APP_ID,
};

const appBudget = getApps().find((a) => a.name === '[DEFAULT]') ?? initializeApp(FIREBASE_CONFIG);
const appPortfolio =
  getApps().find((a) => a.name === 'portfolio') ??
  initializeApp(PORTFOLIO_FIREBASE_CONFIG, 'portfolio');

export const app = appBudget;
export const auth = getAuth(appBudget);
export const authPortfolio = getAuth(appPortfolio);

// initializeFirestore to prevent 400 Bad Request (Listen stream errors)
// in environments with connection limits or specific proxy configurations (e.g. Chrome/Edge)
// We are disabling experimentalForceLongPolling to use WebSockets which are more efficient for multiple streams.
//
// Cache IndexedDB persistant (partagé entre onglets) : les listeners affichent
// immédiatement les dernières données connues au lancement puis se mettent à
// jour depuis le réseau, et les écritures hors ligne sont mises en file. Si
// IndexedDB est indisponible, le SDK retombe de lui-même sur le cache mémoire.
const localCache = () => persistentLocalCache({ tabManager: persistentMultipleTabManager() });
export const db = initializeFirestore(appBudget, { localCache: localCache() });
export const dbPortfolio = initializeFirestore(appPortfolio, { localCache: localCache() });

export const googleProvider = new GoogleAuthProvider();
export const functions = getFunctions(appBudget, 'europe-west1');
