import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { budgetDocKey } from '../utils/budgetKey';
import { withRetry } from '../utils/withRetry';
import { audited, auditedMerge } from '../services/auditLog';
import { toCalendarKey } from '../utils/date';

const COLLECTION_NAME = 'budgets';

/** Données d'écriture d'un budget — champs métier libres + clés connues. */
export interface BudgetWriteData {
  categorie?: string;
  nom?: string;
  [key: string]: unknown;
}

export interface BudgetRecord extends DocumentData {
  id: string;
}

export async function createBudget(data: BudgetWriteData): Promise<string> {
  const now = serverTimestamp();
  // Deterministic doc id keyed on the category name so re-creating an existing
  // category upserts the same document instead of spawning a duplicate (auto-id).
  const id = budgetDocKey(data.categorie || data.nom || '');
  const docRef = doc(db, COLLECTION_NAME, id);
  const payload = { ...data, createdAt: now, updatedAt: now };
  await audited({ domain: 'budget', ref: docRef, action: 'create', patch: payload }, () =>
    withRetry(() => setDoc(docRef, payload, { merge: true })),
  );
  return id;
}

export async function getBudget(id: string): Promise<BudgetRecord | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

export async function updateBudget(id: string, updates: BudgetWriteData): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  // Use setDoc with merge: true instead of updateDoc to support "upsert"
  await auditedMerge('budget', docRef, { ...updates, updatedAt: serverTimestamp() });
}

export async function deleteBudget(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await audited(
    { domain: 'budget', ref: docRef, action: 'delete', keep: ['montant', 'type'] },
    () => withRetry(() => deleteDoc(docRef)),
  );
}

export async function listBudgets({ actifOnly = true } = {}): Promise<BudgetRecord[]> {
  let q: Query<DocumentData> = collection(db, COLLECTION_NAME);
  if (actifOnly) {
    q = query(q, where('actif', '==', true));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function suggestBudgetAmount(categorie: string, months = 12): Promise<number> {
  const q = query(
    collection(db, 'transactions'),
    where('categorie', '==', categorie),
    orderBy('date', 'desc'),
    limit(500),
  );

  const snap = await getDocs(q);
  const txs = snap.docs.map((d) => d.data());

  // Filtrer les dépenses négatives des N derniers mois
  const now = new Date();
  const startDate = new Date();
  startDate.setMonth(now.getMonth() - months);
  const startDateIso = toCalendarKey(startDate);

  const relevantTxs = txs.filter(
    (t) => t.date >= startDateIso && t.categorie !== 'Virement interne',
  );
  const total = relevantTxs.reduce((sum, t) => sum + Math.abs(Number(t.montant) || 0), 0);

  return Math.round((total / months) * 100) / 100;
}
