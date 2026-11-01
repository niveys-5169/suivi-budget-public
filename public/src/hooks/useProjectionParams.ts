import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { withRetry } from '../utils/withRetry';
import { createDefaultProjectionParams } from '../utils/projection/defaults';
import type { ProjectionParams } from '../types/banking.types';

const PARAMS_DOC = doc(db, 'metadata', 'projection_params');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

/** Retire récursivement les `undefined` (Firestore les refuse à l'écriture). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
}

/** Document absent ou de version inconnue : défauts ; sinon défauts écrasés par les champs présents. */
function buildParams(raw: Record<string, unknown> | null): ProjectionParams {
  const defaults = createDefaultProjectionParams(new Date());
  if (!raw || raw.version !== 1) return defaults;
  return { ...defaults, ...raw, version: 1 } as ProjectionParams;
}

/**
 * Paramètres de la projection long terme, stockés dans `metadata/projection_params`.
 * Lus en temps réel ; tant que le document n'existe pas, on retombe sur les défauts.
 */
export function useProjectionParams() {
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      PARAMS_DOC,
      (snap) => {
        setRaw(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading projection params:', err);
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const params = useMemo(() => buildParams(raw), [raw]);
  const exists = raw !== null && raw.version === 1;

  /** Remplacement complet du document (pas de merge : les suppressions de listes doivent persister). */
  const save = useCallback(async (next: ProjectionParams) => {
    const data = stripUndefined(next);
    await withRetry(() => setDoc(PARAMS_DOC, data));
  }, []);

  return { params, exists, loading, error, save };
}
