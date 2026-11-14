import {
  collection,
  doc,
  getDocFromCache,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { withRetry } from '../utils/withRetry';
import { auditLabel, diffChanges, toAuditValue } from '../utils/auditLog';
import type { AuditAction, AuditChange, AuditDomain } from '../types/banking.types';

const COLLECTION_NAME = 'audit_log';
const CHUNK_SIZE = 499;

/** Une modification à consigner dans le journal (`audit_log`). */
export interface AuditSpec {
  domain: AuditDomain;
  /** Document métier modifié. */
  ref: DocumentReference;
  /** `update` par défaut. */
  action?: AuditAction;
  /** Champs écrits : comparés à l'état précédent lu dans le cache local. */
  patch?: Record<string, unknown>;
  /** Changements déjà formulés (liaison, mois ignoré…), à la place de `patch`. */
  changes?: AuditChange[];
  /** Suppression : champs du document supprimé à conserver dans la ligne. */
  keep?: string[];
  /** Libellé lisible ; à défaut, lu dans le patch ou l'état précédent. */
  label?: string;
}

type PreparedEntry = Omit<Required<AuditSpec>, 'ref' | 'patch' | 'keep'> & {
  path: string;
  docId: string;
};

/** État connu du document dans le cache local, sans aller-retour réseau. */
async function readCached(ref: DocumentReference): Promise<Record<string, unknown> | undefined> {
  try {
    return (await getDocFromCache(ref)).data();
  } catch {
    return undefined;
  }
}

async function prepareOne(spec: AuditSpec): Promise<PreparedEntry | null> {
  const action = spec.action ?? 'update';
  const needsBefore = Boolean(spec.patch || spec.keep) || spec.label === undefined;
  const before = needsBefore ? await readCached(spec.ref) : undefined;

  let changes = spec.changes ?? [];
  if (spec.patch && action === 'update') changes = diffChanges(before, spec.patch);
  if (spec.keep && before) {
    changes = spec.keep
      .filter((field) => before[field] !== undefined)
      .map((field) => ({ field, from: toAuditValue(before[field]) }));
  }
  // Un patch qui ne change rien n'est pas une modification.
  if (action === 'update' && changes.length === 0) return null;

  return {
    domain: spec.domain,
    action,
    path: spec.ref.path,
    docId: spec.ref.id,
    label: spec.label ?? auditLabel(spec.domain, before, spec.patch),
    changes,
  };
}

/** Le journal ne doit jamais faire échouer l'action de l'utilisateur. */
async function prepare(specs: AuditSpec | AuditSpec[]): Promise<PreparedEntry[]> {
  try {
    const entries = await Promise.all([specs].flat().map(prepareOne));
    return entries.filter((e): e is PreparedEntry => e !== null);
  } catch (err) {
    console.warn('[auditLog] Préparation du journal impossible :', err);
    return [];
  }
}

async function commit(entries: PreparedEntry[]): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user?.email || entries.length === 0) return;
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      entries.slice(i, i + CHUNK_SIZE).forEach((entry) => {
        batch.set(doc(collection(db, COLLECTION_NAME)), {
          at: serverTimestamp(),
          byEmail: user.email,
          byUid: user.uid,
          ...entry,
        });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('[auditLog] Écriture du journal impossible :', err);
  }
}

/**
 * Exécute une écriture métier et la consigne dans le journal. L'état précédent
 * est lu avant l'écriture ; la ligne n'est écrite que si l'écriture réussit.
 */
export async function audited<T>(
  specs: AuditSpec | AuditSpec[],
  write: () => Promise<T>,
): Promise<T> {
  const entries = await prepare(specs);
  const result = await write();
  await commit(entries);
  return result;
}

/** Consigne une modification déjà faite (création, liaison, mois ignoré…). */
export async function recordAudit(specs: AuditSpec | AuditSpec[]): Promise<void> {
  await commit(await prepare(specs));
}

/** `setDoc(ref, data, { merge: true })` consigné dans le journal. */
export function auditedMerge(
  domain: AuditDomain,
  ref: DocumentReference,
  data: Record<string, unknown>,
  label?: string,
): Promise<void> {
  return audited({ domain, ref, patch: data, label }, () =>
    withRetry(() => setDoc(ref, data, { merge: true })),
  );
}
