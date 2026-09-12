import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  deleteField,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Recurrence, RecurrenceApproval, Transaction } from '../types/banking.types';
import { getApprovalEntries, normalizeLabel } from '../utils/recurrenceEngine';
import { withRetry } from '../utils/withRetry';

const COLLECTION_NAME = 'recurrences';

/**
 * Crée une nouvelle récurrence déterministe à partir d'une transaction existante.
 */
export async function createRecurrenceFromTransaction(tx: Transaction) {
  try {
    const label = tx.libelle || 'Nouvelle récurrence';
    const category = tx.categorie || 'Inconnu';
    const amount = tx.montant ?? 0;

    const dateStr = tx.date.split('T')[0];

    // Lie d'emblée la transaction source pour son mois afin que la récurrence
    // apparaisse comme « payée » plutôt que « en attente » dès sa création.
    const monthKey = (dateStr ?? '').slice(0, 7);
    const canLink = Boolean(tx.id) && tx.id !== 'temp';

    const recRef = doc(collection(db, COLLECTION_NAME));
    const newRecurrence = {
      label,
      category,
      expectedAmount: amount,
      anchorDate: dateStr,
      aliases: [normalizeLabel(label)],
      source: 'manual' as const,
      active: true,
      createdAt: serverTimestamp(),
      approvedMonths: canLink
        ? {
            [monthKey]: {
              txId: tx.id,
              amount,
              date: dateStr,
              approvedAt: Date.now(),
              entries: [{ txId: tx.id, amount, date: dateStr }],
            },
          }
        : {},
    };

    await withRetry(() => setDoc(recRef, newRecurrence));
    return recRef.id;
  } catch (error) {
    console.error('Erreur lors de la création de la récurrence:', error);
    throw error;
  }
}

/**
 * Met à jour les champs éditables d'une récurrence (libellé, catégorie, montant,
 * date d'ancrage).
 */
export async function updateRecurrence(
  id: string,
  patch: Partial<Pick<Recurrence, 'label' | 'category' | 'expectedAmount' | 'anchorDate'>>,
) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => updateDoc(docRef, patch));
  } catch (error) {
    console.error('Erreur lors de la modification de la récurrence:', error);
    throw error;
  }
}

/**
 * Ignore une récurrence pour une période donnée ("pas ce mois-ci").
 */
export async function skipRecurrencePeriod(id: string, periodKey: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => updateDoc(docRef, { skippedPeriods: arrayUnion(periodKey) }));
  } catch (error) {
    console.error("Erreur lors de l'ignorance de la récurrence pour la période:", error);
    throw error;
  }
}

/**
 * Rétablit une récurrence précédemment ignorée pour une période donnée.
 */
export async function unskipRecurrencePeriod(id: string, periodKey: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => updateDoc(docRef, { skippedPeriods: arrayRemove(periodKey) }));
  } catch (error) {
    console.error('Erreur lors du rétablissement de la récurrence pour la période:', error);
    throw error;
  }
}

/**
 * Ajoute un alias appris (libellé normalisé) à une récurrence, pour que les
 * prochaines transactions portant ce libellé soient rattachées automatiquement.
 */
export async function addRecurrenceAlias(id: string, label: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => updateDoc(docRef, { aliases: arrayUnion(normalizeLabel(label)) }));
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'alias à la récurrence:", error);
    throw error;
  }
}

/**
 * Approuve le match d'une récurrence pour un mois donné (YYYY-MM).
 * Si le mois est déjà approuvé, la transaction est AJOUTÉE aux liens existants
 * (ex. salaire versé en deux parties) au lieu de les écraser.
 */
export async function approveRecurrenceMatch(id: string, monthKey: string, tx: Transaction) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const amount = tx.montant ?? 0;
    const date = tx.date.split('T')[0] ?? '';

    const snap = await withRetry(() => getDoc(docRef));
    const existing = (snap.data() as Recurrence | undefined)?.approvedMonths?.[monthKey];
    const entries = existing ? getApprovalEntries(existing) : [];
    if (entries.some((e) => e.txId === tx.id)) return;
    entries.push({ txId: tx.id, amount, date });

    const [first] = entries;
    const approval: RecurrenceApproval = {
      txId: first!.txId,
      amount: first!.amount,
      date: first!.date,
      approvedAt: existing?.approvedAt ?? Date.now(),
      entries,
    };

    await withRetry(() => updateDoc(docRef, { [`approvedMonths.${monthKey}`]: approval }));
  } catch (error) {
    console.error('Erreur lors de l’approbation de la récurrence:', error);
    throw error;
  }
}

/**
 * Délie une seule transaction d'une récurrence (toutes périodes confondues).
 * Supprime le mois entier quand c'était la dernière transaction liée.
 */
export async function unlinkRecurrenceTx(id: string, txId: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const snap = await withRetry(() => getDoc(docRef));
    const approvedMonths = (snap.data() as Recurrence | undefined)?.approvedMonths ?? {};

    const found = Object.entries(approvedMonths).find(([, approval]) =>
      getApprovalEntries(approval).some((e) => e.txId === txId),
    );
    if (!found) return;

    const [monthKey, approval] = found;
    const remaining = getApprovalEntries(approval).filter((e) => e.txId !== txId);

    if (remaining.length === 0) {
      await withRetry(() => updateDoc(docRef, { [`approvedMonths.${monthKey}`]: deleteField() }));
      return;
    }

    const [first] = remaining;
    const next: RecurrenceApproval = {
      txId: first!.txId,
      amount: first!.amount,
      date: first!.date,
      approvedAt: approval.approvedAt,
      entries: remaining,
    };
    await withRetry(() => updateDoc(docRef, { [`approvedMonths.${monthKey}`]: next }));
  } catch (error) {
    console.error('Erreur lors du déliage de la transaction de la récurrence:', error);
    throw error;
  }
}

/**
 * Annule l'approbation d'une récurrence pour un mois donné.
 */
export async function unapproveRecurrenceMonth(id: string, monthKey: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() =>
      updateDoc(docRef, {
        [`approvedMonths.${monthKey}`]: deleteField(),
      }),
    );
  } catch (error) {
    console.error('Erreur lors de la désapprobation de la récurrence:', error);
    throw error;
  }
}

/**
 * Active ou désactive une récurrence.
 */
export async function setRecurrenceActive(id: string, active: boolean) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => updateDoc(docRef, { active }));
  } catch (error) {
    console.error('Erreur lors de la modification de l’état actif de la récurrence:', error);
    throw error;
  }
}

/**
 * Supprime définitivement une récurrence.
 */
export async function removeRecurrence(id: string) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await withRetry(() => deleteDoc(docRef));
  } catch (error) {
    console.error('Erreur lors de la suppression de la récurrence:', error);
    throw error;
  }
}
