import { useMemo, useState } from 'react';
import type { ProjectionParams } from '../../../types/banking.types';

const same = (a: ProjectionParams, b: ProjectionParams) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Brouillon local des paramètres. Il suit `params` tant qu'il n'a pas été modifié
 * (ex. arrivée du document Firestore) ; une fois modifié, il n'est jamais écrasé.
 */
export function useParamsDraft(params: ProjectionParams) {
  const [draft, setDraft] = useState(params);
  const [synced, setSynced] = useState(params);

  if (params !== synced) {
    setSynced(params);
    if (same(draft, synced)) setDraft(params);
  }

  const dirty = useMemo(() => !same(draft, params), [draft, params]);
  const reset = () => setDraft(params);

  return { draft, setDraft, dirty, reset };
}
