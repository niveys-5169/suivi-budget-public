import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useBudgetContext } from '../../context/BudgetContext';
import { PageShell, BackButton } from './PageShell';
import { confirm } from '../../lib/confirm';
import { withRetry } from '../../utils/withRetry';

interface LinxoMapping {
  id: string;
  linxo_category?: string;
  firebase_category?: string;
  linxoCategory?: string;
  budgetCategory?: string;
}

export const MappingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { getBudgetCategoryCandidates } = useBudgetContext();
  const [mappings, setMappings] = useState<LinxoMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newMapping, setNewMapping] = useState({ linxoCategory: '', budgetCategory: '' });

  useEffect(() => {
    const q = query(collection(db, 'linxo_category_mappings'), orderBy('linxoCategory', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMappings(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (error) => {
        console.error('Linxo mappings snapshot failed', error);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const categoryOptions = useMemo(
    () => ['', ...getBudgetCategoryCandidates()],
    [getBudgetCategoryCandidates],
  );

  const saveMapping = async (
    id: string,
    updates: Partial<{ linxoCategory: string; budgetCategory: string }>,
  ) => {
    setSavingId(id);
    try {
      await withRetry(() =>
        setDoc(
          doc(db, 'linxo_category_mappings', id),
          { ...updates, updatedAt: serverTimestamp() },
          { merge: true },
        ),
      );
    } finally {
      setSavingId(null);
    }
  };

  const deleteMapping = async (id: string) => {
    if (!(await confirm({ message: 'Supprimer ce mapping ?', danger: true }))) return;
    await withRetry(() => deleteDoc(doc(db, 'linxo_category_mappings', id)));
  };

  const addMapping = async () => {
    if (!newMapping.linxoCategory.trim()) return;
    setSavingId('new');
    try {
      await addDoc(collection(db, 'linxo_category_mappings'), {
        linxoCategory: newMapping.linxoCategory.trim(),
        budgetCategory: newMapping.budgetCategory || '',
        createdAt: serverTimestamp(),
      });
      setNewMapping({ linxoCategory: '', budgetCategory: '' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PageShell
      title="Mappings"
      description="Gérez les correspondances entre catégories Linxo et catégories Aurum."
    >
      <BackButton onBack={() => navigate('/advanced')} />
      <div className="mt-8 space-y-8">
        <div className="overflow-hidden rounded-xl bg-white/5 border border-separator">
          <table className="min-w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-white/5 text-label/70 text-caption">
                <th className="px-6 py-4">Libellé Linxo</th>
                <th className="px-6 py-4">Catégorie Aurum</th>
                <th className="px-6 py-4 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-label/50">
                    Chargement...
                  </td>
                </tr>
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-label/50">
                    Aucun mapping trouvé.
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-t border-separator">
                    <td className="px-6 py-4">
                      <input
                        value={mapping.linxoCategory || ''}
                        onChange={(e) => saveMapping(mapping.id, { linxoCategory: e.target.value })}
                        className="w-full bg-transparent border border-separator rounded-xl px-4 py-4 text-white outline-none focus:border-gold/30"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={mapping.budgetCategory || ''}
                        onChange={(e) =>
                          saveMapping(mapping.id, { budgetCategory: e.target.value })
                        }
                        className="w-full bg-transparent border border-separator rounded-xl px-4 py-4 text-white outline-none focus:border-gold/30"
                      >
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {category || '(non mappé)'}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => deleteMapping(mapping.id)}
                        className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-negative/10 text-negative hover:bg-negative/20 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-white/5 border border-separator p-8 grid gap-6 lg:grid-cols-[1fr_auto] items-end">
          <div className="grid gap-4">
            <div>
              <label htmlFor="linxo-category" className="block text-sm text-label/70">
                Nouveau libellé Linxo
              </label>
              <input
                id="linxo-category"
                value={newMapping.linxoCategory}
                onChange={(e) => setNewMapping({ ...newMapping, linxoCategory: e.target.value })}
                className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white outline-none focus:border-gold/30"
              />
            </div>
            <div>
              <label htmlFor="budget-category" className="block text-sm text-label/70">
                Catégorie Aurum
              </label>
              <select
                id="budget-category"
                value={newMapping.budgetCategory}
                onChange={(e) => setNewMapping({ ...newMapping, budgetCategory: e.target.value })}
                className="w-full h-16 rounded-lg bg-white/5 border border-separator px-4 text-base text-white outline-none focus:border-gold/30"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category || '(non mappé)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            disabled={!newMapping.linxoCategory.trim() || savingId === 'new'}
            onClick={addMapping}
            className="h-16 rounded-lg bg-gold text-bg font-semibold px-6 hover:bg-gold-light transition"
          >
            Ajouter
          </button>
        </div>
      </div>
    </PageShell>
  );
};
