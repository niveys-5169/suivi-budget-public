import {
  collection,
  doc,
  writeBatch,
  deleteField,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';
import { withRetry } from '../utils/withRetry';

export const collectionRef = (db: Firestore, name: string) => collection(db, name);
export const docRef = (db: Firestore, col: string, id: string) => doc(db, col, id);
export const createBatch = (db: Firestore) => writeBatch(db);
export const fieldDelete = () => deleteField();

export async function getGitHubSettings() {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;
  try {
    const docSnap = await getDoc(doc(db, 'user_settings', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        owner: data.github_owner || 'niveys-5169',
        repo: data.github_repo || 'Suivi-Budget',
      };
    }
  } catch (e) {
    console.warn('Error loading GitHub settings:', e);
  }
  return { owner: 'niveys-5169', repo: 'Suivi-Budget' };
}

export async function saveGitHubSettings(owner: string, repo: string) {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Not authenticated');
  }
  try {
    await withRetry(() =>
      setDoc(
        doc(db, 'user_settings', userId),
        {
          github_owner: owner,
          github_repo: repo,
          updated_at: new Date(),
        },
        { merge: true },
      ),
    );
    return true;
  } catch (e) {
    console.error('Error saving GitHub settings:', e);
    throw e;
  }
}

export async function getAISettings() {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;
  try {
    const docSnap = await getDoc(doc(db, 'user_settings', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.ai_provider) {
        return {
          provider: data.ai_provider as string,
          apiKey: data.ai_api_key || '',
          model: (data.ai_model as string) || null,
          baseUrl: (data.ai_base_url as string) || null,
        };
      }
    }
  } catch (e) {
    console.warn('Error loading AI settings:', e);
  }
  return null;
}

export async function saveAISettings(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const userId = auth.currentUser?.uid;
  if (!userId) return;
  try {
    await withRetry(() =>
      setDoc(
        doc(db, 'user_settings', userId),
        {
          ai_provider: provider,
          ai_api_key: apiKey,
          ai_model: model,
          ai_base_url: baseUrl,
          updated_at: new Date(),
        },
        { merge: true },
      ),
    );
  } catch (e) {
    console.warn('Error saving AI settings:', e);
  }
}

/**
 * Déclenche un workflow GitHub Action via la Cloud Function `dispatch_github_workflow`.
 * Le jeton GitHub reste côté serveur : il ne transite jamais par le navigateur.
 */
export async function triggerGitHubWorkflow(
  eventType = 'import-linxo',
  clientPayload: Record<string, unknown> | null = null,
) {
  try {
    const dispatch = httpsCallable(functions, 'dispatch_github_workflow');
    const res = await dispatch({
      event_type: eventType,
      ...(clientPayload ? { client_payload: clientPayload } : {}),
    });
    return res.data;
  } catch (e) {
    console.error('GitHub Workflow Error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: msg };
  }
}

/**
 * Déclenche l'import Linxo via GitHub Action.
 */
export async function triggerLinxoImport() {
  return await triggerGitHubWorkflow('import-linxo');
}
