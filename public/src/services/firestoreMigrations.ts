import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { withRetry } from '../utils/withRetry';

export const ensureUserPreferencesExist = async (uid: string): Promise<void> => {
  try {
    const preferenceRef = doc(db, 'users', uid, 'preferences', 'dashboardCategories');
    const docSnap = await getDoc(preferenceRef);

    if (!docSnap.exists()) {
      await withRetry(() => setDoc(preferenceRef, { categories: [] }, { merge: true }));
    }
  } catch (err) {
    console.error('>>> firestoreMigrations: Failed to ensure user preferences:', err);
  }
};
