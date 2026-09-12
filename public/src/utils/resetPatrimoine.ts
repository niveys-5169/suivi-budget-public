import { collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { withRetry } from './withRetry';

/**
 * Collections vidées lors d'une réinitialisation complète du patrimoine.
 * metadata/account_owners_mapping est volontairement conservé (config propriétaires).
 */
export const WIPE_COLLECTIONS = [
  'placement_history',
  'placements',
  'savings_balances',
  'account_balances',
  'patrimoine_snapshots',
] as const;

const BATCH_SIZE = 450; // < 500 (limite Firestore par writeBatch)

function todayStamp(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Exporte l'intégralité des collections patrimoine en JSON et déclenche un téléchargement.
 * Filet de sécurité appelé AVANT toute suppression.
 */
export async function backupPatrimoine(): Promise<void> {
  const collections: Record<string, Array<Record<string, unknown>>> = {};

  for (const name of WIPE_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const payload = { exportedAt: new Date().toISOString(), collections };
  const json = JSON.stringify(payload, null, 2);
  // data: URI avoids the async popup-blocker issue (a.click() inside a Promise chain)
  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  const a = document.createElement('a');
  a.href = dataUri;
  a.download = `patrimoine-backup-${todayStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Supprime tous les documents des collections patrimoine (par chunks) et remet
 * metadata/patrimoine_settings.portfolioValue à 0. Retourne le nombre de docs supprimés
 * par collection.
 */
export async function wipePatrimoine(): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};

  for (const name of WIPE_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    const ids = snap.docs.map((d) => d.id);

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH_SIZE).forEach((id) => batch.delete(doc(db, name, id)));
      await withRetry(() => batch.commit());
    }

    deleted[name] = ids.length;
  }

  await withRetry(() =>
    setDoc(doc(db, 'metadata', 'patrimoine_settings'), { portfolioValue: 0 }, { merge: true }),
  );

  return deleted;
}

/**
 * Réinitialisation complète : sauvegarde JSON PUIS suppression.
 * Si la sauvegarde échoue, rien n'est effacé.
 */
export async function resetPatrimoine(): Promise<Record<string, number>> {
  await backupPatrimoine();
  return wipePatrimoine();
}
