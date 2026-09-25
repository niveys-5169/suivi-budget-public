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
import { migrateLegacyAISettings, sanitizeAISettings, type AISettings } from '../utils/aiConfig';

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

/**
 * Réglages IA synchronisés (Firestore `user_settings.ai_settings`). Migre
 * l'ancien format à plat (`ai_provider`, `ai_api_key`…) s'il est seul présent.
 */
export async function getAISettings(): Promise<AISettings | null> {
  const userId = auth.currentUser?.uid;
  if (!userId) return null;
  try {
    const docSnap = await getDoc(doc(db, 'user_settings', userId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.ai_settings) return sanitizeAISettings(data.ai_settings);
      if (data.ai_provider) {
        return migrateLegacyAISettings({
          provider: data.ai_provider,
          apiKey: data.ai_api_key,
          model: data.ai_model,
          baseUrl: data.ai_base_url,
          searchApiKey: data.search_api_key,
        });
      }
    }
  } catch (e) {
    console.warn('Error loading AI settings:', e);
  }
  return null;
}

/** Enregistre les réglages IA dans Firestore. Lève en cas d'échec. */
export async function saveAISettings(settings: AISettings): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Non connecté : réglages enregistrés sur cet appareil seulement.');
  await withRetry(() =>
    setDoc(
      doc(db, 'user_settings', userId),
      { ai_settings: sanitizeAISettings(settings), updated_at: new Date() },
      { merge: true },
    ),
  );
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
