import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { AuditAction, AuditChange, AuditDomain, AuditEntry } from '../types/banking.types';

export const PAGE_SIZE = 200;
const COLLECTION_NAME = 'audit_log';
const DOMAINS: unknown[] = ['transaction', 'budget', 'recurrence'] satisfies AuditDomain[];
const ACTIONS: unknown[] = ['create', 'update', 'delete'] satisfies AuditAction[];

const isChange = (c: unknown): c is AuditChange =>
  typeof c === 'object' && c !== null && typeof (c as { field?: unknown }).field === 'string';

/** Ligne lue, ou `null` si son domaine ou son action est inconnu (ligne mal formée). */
const toEntry = (d: QueryDocumentSnapshot): AuditEntry | null => {
  // `estimate` : une ligne tout juste écrite a déjà une date locale approchée.
  const data = d.data({ serverTimestamps: 'estimate' });
  if (!DOMAINS.includes(data.domain) || !ACTIONS.includes(data.action)) return null;
  return {
    id: d.id,
    at: typeof data.at?.toDate === 'function' ? data.at.toDate() : null,
    byEmail: data.byEmail ?? '',
    domain: data.domain,
    action: data.action,
    path: data.path ?? '',
    docId: data.docId ?? '',
    label: data.label ?? '',
    changes: Array.isArray(data.changes) ? data.changes.filter(isChange) : [],
  };
};

const byDateDesc = (a: AuditEntry, b: AuditEntry) =>
  (b.at?.getTime() ?? Infinity) - (a.at?.getTime() ?? Infinity);

/** Écoute une requête sur `audit_log`. */
const subscribe = (q: Query, onEntries: (entries: AuditEntry[]) => void, onError: () => void) =>
  onSnapshot(
    q,
    (snap) =>
      onEntries(
        snap.docs
          .map(toEntry)
          .filter((e): e is AuditEntry => e !== null)
          .sort(byDateDesc),
      ),
    (err) => {
      console.error('[useAuditLog] Erreur écoute audit_log:', err);
      onError();
    },
  );

/**
 * Les `max` dernières lignes du journal, de la plus récente à la plus ancienne.
 * `error` : la lecture a échoué (à ne pas confondre avec un journal vide).
 */
export const useAuditLog = (max: number) => {
  // Sans Firestore configuré, rien à charger.
  const [state, setState] = useState({
    entries: [] as AuditEntry[],
    loading: Boolean(db),
    error: false,
  });

  useEffect(() => {
    if (!db) return;
    return subscribe(
      query(collection(db, COLLECTION_NAME), orderBy('at', 'desc'), limit(max)),
      (entries) => setState({ entries, loading: false, error: false }),
      () => setState({ entries: [], loading: false, error: true }),
    );
  }, [max]);

  return state;
};

/** Lignes du journal d'un document (ex. `transactions/<id>`), les plus récentes d'abord. */
export const useDocumentAudit = (path: string | null): AuditEntry[] => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!db || !path) return;
    // Une erreur de lecture masque simplement le rappel.
    return subscribe(
      query(collection(db, COLLECTION_NAME), where('path', '==', path)),
      setEntries,
      () => setEntries([]),
    );
  }, [path]);

  // Écarte les lignes du document précédent pendant le changement d'écoute.
  return entries.filter((e) => e.path === path);
};
