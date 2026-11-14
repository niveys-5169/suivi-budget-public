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
import type { AuditEntry } from '../types/banking.types';

export const PAGE_SIZE = 200;
const COLLECTION_NAME = 'audit_log';

const toEntry = (d: QueryDocumentSnapshot): AuditEntry => {
  // `estimate` : une ligne tout juste écrite a déjà une date locale approchée.
  const data = d.data({ serverTimestamps: 'estimate' });
  return {
    id: d.id,
    at: typeof data.at?.toDate === 'function' ? data.at.toDate() : null,
    byEmail: data.byEmail ?? '',
    domain: data.domain,
    action: data.action,
    path: data.path ?? '',
    docId: data.docId ?? '',
    label: data.label ?? '',
    changes: Array.isArray(data.changes) ? data.changes : [],
  };
};

const byDateDesc = (a: AuditEntry, b: AuditEntry) =>
  (b.at?.getTime() ?? Infinity) - (a.at?.getTime() ?? Infinity);

/** Écoute une requête sur `audit_log` ; une erreur de lecture donne une liste vide. */
const subscribe = (q: Query, onEntries: (entries: AuditEntry[]) => void) =>
  onSnapshot(
    q,
    (snap) => onEntries(snap.docs.map(toEntry).sort(byDateDesc)),
    (err) => {
      console.error('[useAuditLog] Erreur écoute audit_log:', err);
      onEntries([]);
    },
  );

/** Les `max` dernières lignes du journal, de la plus récente à la plus ancienne. */
export const useAuditLog = (max: number) => {
  // Sans Firestore configuré, rien à charger.
  const [state, setState] = useState({ entries: [] as AuditEntry[], loading: Boolean(db) });

  useEffect(() => {
    if (!db) return;
    return subscribe(
      query(collection(db, COLLECTION_NAME), orderBy('at', 'desc'), limit(max)),
      (entries) => setState({ entries, loading: false }),
    );
  }, [max]);

  return state;
};

/** Lignes du journal d'un document (ex. `transactions/<id>`), les plus récentes d'abord. */
export const useDocumentAudit = (path: string | null): AuditEntry[] => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!db || !path) return;
    return subscribe(query(collection(db, COLLECTION_NAME), where('path', '==', path)), setEntries);
  }, [path]);

  // Écarte les lignes du document précédent pendant le changement d'écoute.
  return entries.filter((e) => e.path === path);
};
