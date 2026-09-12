import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
  DocumentData,
  Timestamp,
  Query,
} from 'firebase/firestore';
import { z } from 'zod';
import { db, auth } from './firebase';
import { withRetry } from '../utils/withRetry';
import { Transaction } from '../types/banking.types';

/** Convertit une date Firestore (Timestamp, ISO string, …) en `YYYY-MM-DD`. */
const toIsoDate = (value: unknown): string => {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return value != null ? String(value).slice(0, 10) : '';
};

/**
 * Schéma canonique d'un document `transactions` Firestore → `Transaction`.
 * Source de vérité unique de la frontière de désérialisation : les champs
 * obligatoires manquants (date, libellé, montant non numérique) font échouer
 * le parse, ce que `normalizeTransaction` traduit en `null`.
 */
export const TransactionDocZ = z
  .object({
    id: z.unknown().optional(),
    date: z.unknown(),
    libelle: z.unknown(),
    montant: z.unknown(),
    compte: z.unknown().optional(),
    categorie: z.unknown().optional(),
    commentaire: z.unknown().optional(),
    pointe: z.unknown().optional(),
    moisAffectation: z.unknown().optional(),
    source: z.unknown().optional(),
    importedAt: z.unknown().optional(),
    edf_compte: z.unknown().optional(),
    rechargeId: z.unknown().optional(),
  })
  .transform((d, ctx): Transaction => {
    const date = toIsoDate(d.date);
    const libelle = d.libelle != null ? String(d.libelle).trim() : '';
    const montant = Number(d.montant);

    if (!date || !libelle || Number.isNaN(montant)) {
      ctx.addIssue({ code: 'custom', message: 'transaction malformée (date/libellé/montant)' });
      return z.NEVER;
    }

    return {
      id: (d.id as string) || '',
      date,
      libelle,
      montant,
      compte: String(d.compte ?? '').trim(),
      categorie: String(d.categorie ?? '').trim() || undefined,
      commentaire: String(d.commentaire ?? '').trim() || undefined,
      pointe: d.pointe === true,
      moisAffectation: d.moisAffectation ? String(d.moisAffectation).slice(0, 7) : undefined,
      source: d.source ? String(d.source) : undefined,
      importedAt: d.importedAt as Timestamp | null,
      edfCompte: d.edf_compte ? String(d.edf_compte).trim() || undefined : undefined,
      rechargeId: d.rechargeId ? String(d.rechargeId) : undefined,
    };
  });

/** Normalizes a raw Firestore document into a Transaction. Returns null if the document is malformed. */
export function normalizeTransaction(data: DocumentData): Transaction | null {
  if (!data || typeof data !== 'object') return null;
  const result = TransactionDocZ.safeParse(data);
  return result.success ? result.data : null;
}

/** Builds the Firestore query for transactions. loadAll removes the 18-month date filter. */
export function buildTransactionQuery(loadAll: boolean): Query {
  if (loadAll) {
    return query(collection(db, 'transactions'), orderBy('date', 'desc'));
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 18);
  return query(
    collection(db, 'transactions'),
    where('date', '>=', cutoff.toISOString().slice(0, 10)),
    orderBy('date', 'desc'),
  );
}

export async function updatePointe(id: string, checked: boolean): Promise<void> {
  await withRetry(() => updateDoc(doc(db, 'transactions', id), { pointe: checked }));
}

export async function removeTransaction(id: string): Promise<void> {
  await withRetry(async () => {
    await deleteDoc(doc(db, 'transactions', id));
    await setDoc(
      doc(db, 'deleted_transactions', id),
      {
        transactionId: id,
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.email || '',
        source: 'react_hook',
      },
      { merge: true },
    );
  });
}

export async function persistTransaction(
  transaction: Partial<Transaction> & { id?: string },
): Promise<void> {
  const { id, ...data } = transaction;
  await withRetry(async () => {
    if (id) {
      await updateDoc(doc(db, 'transactions', id), data);
    } else {
      await addDoc(collection(db, 'transactions'), {
        ...data,
        importedAt: serverTimestamp(),
        source: data.source || 'manuel',
        pointe: data.pointe ?? false,
      });
    }
  });
}

// ── Couplage recharge Tronity ↔ crédit EDF ──────────────────────────────────
// Le crédit EDF compensateur n'est plus créé à l'import : il est généré ici
// quand une recharge est pointée, et supprimé quand elle est dépointée.

export const RECHARGE_LIBELLE = 'Recharge domicile EV';
export const RECHARGE_CATEGORIE = 'Recharge domicile';

/** Vrai si la transaction est une recharge domicile Tronity portant un compte EDF cible. */
export function isRechargeDomicile(tx: Transaction): boolean {
  return tx.source === 'tronity' && tx.categorie === RECHARGE_CATEGORIE && Boolean(tx.edfCompte);
}

/** Construit les champs du crédit EDF (positif) compensant une recharge pointée. */
export function buildEdfCredit(recharge: Transaction): Partial<Transaction> {
  return {
    date: recharge.date,
    libelle: RECHARGE_LIBELLE,
    compte: recharge.edfCompte,
    montant: -recharge.montant,
    categorie: RECHARGE_CATEGORIE,
    commentaire: `Crédit EDF compensant ${RECHARGE_LIBELLE}`,
    pointe: true,
    rechargeId: recharge.id,
    source: 'tronity',
  };
}

/** Crée le crédit EDF (positif) compensant une recharge pointée (idempotent). */
export async function createEdfCreditForRecharge(recharge: Transaction): Promise<void> {
  if (!recharge.edfCompte) return;
  await withRetry(async () => {
    const existing = await getDocs(
      query(collection(db, 'transactions'), where('rechargeId', '==', recharge.id)),
    );
    if (!existing.empty) return;
    await addDoc(collection(db, 'transactions'), {
      ...buildEdfCredit(recharge),
      importedAt: serverTimestamp(),
    });
  });
}

/** Supprime le crédit EDF lié à une recharge dépointée (sans tombstone : repointer le recrée). */
export async function deleteEdfCredit(creditId: string): Promise<void> {
  await withRetry(() => deleteDoc(doc(db, 'transactions', creditId)));
}

/** Supprime tous les crédits EDF liés à une recharge (par rechargeId). */
export async function deleteAllEdfCredits(rechargeId: string): Promise<void> {
  await withRetry(async () => {
    const snaps = await getDocs(
      query(collection(db, 'transactions'), where('rechargeId', '==', rechargeId)),
    );
    await Promise.all(snaps.docs.map((d) => deleteDoc(d.ref)));
  });
}

/** Updates the `pointe` field on a set of transactions in Firestore batches of 499. */
export async function batchSetPointe(txs: Transaction[], pointe: boolean): Promise<void> {
  const CHUNK_SIZE = 499;
  for (let i = 0; i < txs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    txs.slice(i, i + CHUNK_SIZE).forEach((tx) => {
      batch.update(doc(db, 'transactions', tx.id), { pointe });
    });
    await batch.commit();
  }
}

/** Applique le même `patch` partiel à un ensemble de transactions par batches de 499. */
export async function batchUpdateTransactions(
  ids: string[],
  patch: Partial<Transaction>,
): Promise<void> {
  const CHUNK_SIZE = 499;
  await withRetry(async () => {
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK_SIZE).forEach((id) => {
        batch.update(doc(db, 'transactions', id), patch);
      });
      await batch.commit();
    }
  });
}

/**
 * Supprime un ensemble de transactions par batches, en écrivant pour chacune le
 * tombstone `deleted_transactions` attendu par le backend (cf. `removeTransaction`).
 * Chaque transaction consomme 2 écritures (suppression + tombstone), d'où une
 * taille de chunk de 249 pour rester sous la limite Firestore de 500 par batch.
 */
export async function batchRemoveTransactions(ids: string[]): Promise<void> {
  const CHUNK_SIZE = 249;
  const deletedBy = auth.currentUser?.email || '';
  await withRetry(async () => {
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + CHUNK_SIZE).forEach((id) => {
        batch.delete(doc(db, 'transactions', id));
        batch.set(
          doc(db, 'deleted_transactions', id),
          {
            transactionId: id,
            deletedAt: serverTimestamp(),
            deletedBy,
            source: 'react_hook',
          },
          { merge: true },
        );
      });
      await batch.commit();
    }
  });
}
