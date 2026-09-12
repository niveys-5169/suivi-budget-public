import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  serverTimestamp,
  where,
  getDocs,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useBudgetContext } from '../../context/BudgetContext';
import { useTransactionContext } from '../../context/TransactionContext';
import { PageShell, BackButton } from './PageShell';
import { confirm } from '../../lib/confirm';
import { withRetry } from '../../utils/withRetry';

export const FusionPage: React.FC = () => {
  const navigate = useNavigate();
  const { transactions } = useTransactionContext();
  const { getBudgetCategoryCandidates } = useBudgetContext();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const transactionCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach((tx) => categories.add(tx.categorie || 'A Catégoriser'));
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const candidates = getBudgetCategoryCandidates();
    const list = [
      'A Catégoriser',
      ...candidates.filter((cat) => !transactionCategories.includes(cat)),
    ];
    return list;
  }, [getBudgetCategoryCandidates, transactionCategories]);

  const counts = useMemo(() => {
    return transactionCategories.reduce(
      (acc, cat) => {
        acc[cat] = transactions.filter((tx) => (tx.categorie || 'A Catégoriser') === cat).length;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [transactionCategories, transactions]);

  const changed = useMemo(() => {
    return Object.entries(assignments).filter(([src, tgt]) => tgt && tgt !== src);
  }, [assignments]);

  const applyFusions = async () => {
    if (!changed.length) return;
    if (
      !(await confirm({
        message: `Appliquer ${changed.length} fusion(s) ? Cette action est irréversible.`,
        danger: true,
      }))
    )
      return;

    setSaving(true);
    setStatus('Préparation de l’application...');

    try {
      const updates: { ref: DocumentReference; target: string }[] = [];
      for (const [source, target] of changed) {
        const txQuery = query(collection(db, 'transactions'), where('categorie', '==', source));
        const txSnap = await getDocs(txQuery);
        txSnap.docs.forEach((docSnap) => {
          updates.push({ ref: docSnap.ref, target });
        });
      }
      const CHUNK_SIZE = 400;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(({ ref, target }) => {
          batch.update(ref, { categorie: target, updatedAt: serverTimestamp() });
        });
        await withRetry(() => batch.commit());
      }
      setAssignments({});
      setStatus('Fusions appliquées avec succès. Rafraîchissez la page pour voir les résultats.');
    } catch (error) {
      console.error(error);
      setStatus('Erreur lors de l’application des fusions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Fusion de catégories"
      description="Regroupez plusieurs catégories en une seule et mettez à jour les transactions en masse."
    >
      <BackButton onBack={() => navigate('/advanced')} />
      <div className="mt-8 overflow-hidden rounded-xl bg-white/5 border border-separator">
        <table className="min-w-full border-collapse text-sm text-left">
          <thead>
            <tr className="bg-white/5 text-label/70 text-caption">
              <th className="px-6 py-4">Catégorie source</th>
              <th className="px-6 py-4">Transactions</th>
              <th className="px-6 py-4">Fusionner vers</th>
            </tr>
          </thead>
          <tbody>
            {transactionCategories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-label/50">
                  Aucune catégorie trouvée.
                </td>
              </tr>
            ) : (
              transactionCategories.map((cat) => (
                <tr key={cat} className="border-t border-separator">
                  <td className="px-6 py-4">{cat}</td>
                  <td className="px-6 py-4 text-label/70">{counts[cat] ?? 0}</td>
                  <td className="px-6 py-4">
                    <select
                      value={assignments[cat] ?? cat}
                      onChange={(event) =>
                        setAssignments((prev) => ({ ...prev, [cat]: event.target.value }))
                      }
                      className="w-full h-14 rounded-lg bg-white/5 border border-separator px-4 text-white outline-none focus:border-gold/30"
                    >
                      {categoryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={applyFusions}
          disabled={saving || changed.length === 0}
          className="h-16 rounded-lg bg-gold text-bg font-semibold px-8 hover:bg-gold-light transition disabled:opacity-60"
        >
          {saving ? 'Application...' : `Appliquer (${changed.length})`}
        </button>
        {status && <p className="text-sm text-label/70">{status}</p>}
      </div>
    </PageShell>
  );
};
