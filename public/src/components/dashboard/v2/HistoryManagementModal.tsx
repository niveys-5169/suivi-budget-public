import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Loader2,
  Search,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../../shared/Modal';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { toast } from '../../../lib/toast';
import { usePatrimoine } from '../../../hooks/usePatrimoine';
import { formatCurrency } from '../../../lib/formatters';
import { parseDecimal } from '../../../utils/format';
import { buildHistoryAssets } from '../../../utils/historyAssets';
import { withRetry } from '../../../utils/withRetry';

interface HistoryEntry {
  id: string;
  assetId: string;
  date: string;
  montant: number;
  type: string;
  owner: string;
  source?: string;
}

interface Props {
  onClose: () => void;
}

export const HistoryManagementModal: React.FC<Props> = ({ onClose }) => {
  const { placements, savingsBalances, accountBalances, placementHistory, ownerMapping } =
    usePatrimoine();

  const allAssets = useMemo(
    () =>
      buildHistoryAssets({
        placements,
        savingsBalances,
        accountBalances,
        placementHistory,
        ownerMapping,
      }),
    [placements, savingsBalances, accountBalances, placementHistory, ownerMapping],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(() => {
    return allAssets[0]?.id || '';
  });

  const [rows, setRows] = useState<HistoryEntry[]>([]);
  const [localRows, setLocalRows] = useState<HistoryEntry[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Changes Validation
  const hasChanges = useMemo(() => {
    if (deletedIds.size > 0) return true;
    if (localRows.length !== rows.length) return true;

    return localRows.some((local) => {
      const original = rows.find((r) => r.id === local.id);
      if (!original) return true; // It's a new row
      return local.montant !== original.montant || local.date !== original.date;
    });
  }, [localRows, rows, deletedIds]);

  const duplicateDates = useMemo(() => {
    const dates = localRows.map((r) => r.date);
    return dates.filter((date, index) => dates.indexOf(date) !== index);
  }, [localRows]);

  const hasDuplicateDates = duplicateDates.length > 0;

  // History Fetching
  useEffect(() => {
    if (!selectedAssetId) {
      setRows([]);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'placement_history'),
      where('assetId', '==', selectedAssetId),
      orderBy('date', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const historyData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as HistoryEntry[];
        setRows(historyData);
        setLocalRows(historyData);
        setDeletedIds(new Set());
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching history:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [selectedAssetId]);

  // Ensure selectedAssetId is updated if assets load later
  useEffect(() => {
    if (!selectedAssetId && allAssets.length > 0) {
      setSelectedAssetId(allAssets[0]!.id);
    }
  }, [allAssets, selectedAssetId]);

  const handleAddRow = () => {
    const selectedAsset = allAssets.find((a) => a.id === selectedAssetId);
    if (!selectedAsset) return;

    const newRow: HistoryEntry = {
      id: `temp_${Date.now()}`,
      assetId: selectedAssetId,
      date: new Date().toISOString().split('T')[0]!,
      montant: 0,
      owner: selectedAsset.owner,
      type: selectedAsset.type,
    };

    setLocalRows((prev) => [newRow, ...prev]);
    setEditingRowId(newRow.id);
    setEditingValue('0');
  };

  const handleEditStart = (row: HistoryEntry) => {
    setEditingRowId(row.id);
    setEditingValue(row.montant.toString());
  };

  const handleEditComplete = (id: string) => {
    const newValue = parseDecimal(editingValue);
    if (newValue !== null) {
      setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, montant: newValue } : r)));
    }
    setEditingRowId(null);
  };

  const handleUpdateDate = (id: string, newDate: string) => {
    setLocalRows((prev) => prev.map((r) => (r.id === id ? { ...r, date: newDate } : r)));
  };

  const handleDeleteRow = (id: string) => {
    setLocalRows((prev) => prev.filter((r) => r.id !== id));
    if (!id.startsWith('temp_')) {
      setDeletedIds((prev) => new Set(prev).add(id));
    }
  };

  const handleResetRow = (id: string) => {
    const originalRow = rows.find((r) => r.id === id);
    if (originalRow) {
      setLocalRows((prev) => prev.map((r) => (r.id === id ? originalRow : r)));
    }
  };

  const handleSave = async () => {
    if (!hasChanges || hasDuplicateDates || saveLoading) return;

    setSaveLoading(true);
    try {
      const batch = writeBatch(db);

      // Handle deletions
      deletedIds.forEach((id) => {
        batch.delete(doc(db, 'placement_history', id));
      });

      // Handle additions and updates
      localRows.forEach((row) => {
        const isNew = row.id.startsWith('temp_');
        const original = rows.find((r) => r.id === row.id);
        const isModified =
          !isNew && original && (row.montant !== original.montant || row.date !== original.date);

        if (isNew) {
          // New ID: assetId_date
          const newId = `${row.assetId}_${row.date}`;
          const { id: _, ...data } = row;
          batch.set(doc(db, 'placement_history', newId), data);
        } else if (isModified) {
          const { id: _, ...data } = row;
          batch.update(doc(db, 'placement_history', row.id), data);
        }
      });

      await withRetry(() => batch.commit());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving history changes:', error);
      toast.error('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaveLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Gestion de l'Historique"
      subtitle="Consulter et modifier les points de données historiques"
      variant="sheet"
      size="lg"
      fullHeight
    >
      <div className="flex flex-col">
        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Asset Selection */}
          <div className="max-w-md space-y-4">
            <label htmlFor="asset-select" className="text-caption font-semibold text-gold/50 ml-1">
              Sélectionner un actif
            </label>
            <div className="relative">
              <select
                id="asset-select"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full h-14 bg-surface border border-separator rounded-lg px-4 text-white text-sm outline-none focus:border-gold/30 focus:bg-white/[0.05] transition-all appearance-none cursor-pointer"
              >
                {allAssets.length === 0 && <option value="">Aucun actif trouvé</option>}
                {allAssets.map((asset) => (
                  <option key={asset.id} value={asset.id} className="bg-[#14141C] py-2">
                    {asset.nom} ({asset.owner})
                  </option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-label-tertiary">
                <Search size={16} />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="relative min-h-[400px] rounded-lg border border-separator bg-surface overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Loader2 size={24} className="text-gold animate-spin" />
                <p className="text-xs text-label-tertiary font-bold">Chargement des données...</p>
              </div>
            ) : localRows.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-label-tertiary mb-2">
                  <History size={32} />
                </div>
                <p className="text-white/40 font-medium">Aucun historique trouvé pour cet actif.</p>
                <p className="text-caption text-label-tertiary max-w-[200px] leading-relaxed">
                  Utilise le bouton snapshot pour ajouter des données initiales.
                </p>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-4">
                      <h3 className="text-sm font-bold text-white/80">Entrées historiques</h3>
                      <span className="text-caption bg-white/5 px-4 py-1 rounded-full text-white/40 font-semibold">
                        {localRows.length} {localRows.length > 1 ? 'points' : 'point'}
                      </span>
                    </div>
                    {hasDuplicateDates && (
                      <div className="flex items-center gap-2 text-negative">
                        <AlertCircle size={12} />
                        <span className="text-caption font-bold">Dates en double détectées</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/20 text-gold hover:bg-gold/20 transition-all text-caption font-semibold"
                  >
                    <Plus size={14} />
                    Ajouter un point
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-caption font-semibold text-label-tertiary">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Propriétaire / Type</th>
                        <th className="px-6 py-4">Montant</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localRows.map((row) => {
                        const isNew = row.id.startsWith('temp_');
                        const originalRow = rows.find((r) => r.id === row.id);
                        const isModified =
                          !isNew &&
                          originalRow &&
                          (row.montant !== originalRow.montant || row.date !== originalRow.date);
                        const isEditing = editingRowId === row.id;
                        const isDuplicate = duplicateDates.includes(row.date);

                        return (
                          <tr
                            key={row.id}
                            className={`group transition-colors rounded-lg ${
                              isDuplicate
                                ? 'bg-negative/5 hover:bg-negative/10'
                                : 'bg-white/[0.01] hover:bg-surface'
                            }`}
                          >
                            <td className="px-6 py-4 text-xs text-white/60 font-medium whitespace-nowrap">
                              {isNew || isModified ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={row.date}
                                    onChange={(e) => handleUpdateDate(row.id, e.target.value)}
                                    className={`bg-white/5 border rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-gold/30 ${
                                      isDuplicate ? 'border-negative' : 'border-separator'
                                    }`}
                                  />
                                  {isDuplicate && (
                                    <AlertCircle size={14} className="text-negative" />
                                  )}
                                </div>
                              ) : (
                                formatDate(row.date)
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-white font-semibold">
                                  {row.owner}
                                </span>
                                <span className="text-caption text-white/30">{row.type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={() => handleEditComplete(row.id)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleEditComplete(row.id)}
                                  className="w-32 bg-white/5 border border-gold/30 rounded-lg px-4 py-1 text-sm text-gold outline-none"
                                />
                              ) : (
                                <div
                                  onClick={() => handleEditStart(row)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleEditStart(row);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  className={`inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl transition-all ${
                                    isModified || isNew
                                      ? 'bg-gold/10 border border-gold/30 text-gold'
                                      : 'hover:bg-white/5 text-white/80 border border-transparent'
                                  }`}
                                >
                                  <span className="text-sm font-mono font-medium">
                                    {formatCurrency(row.montant)}
                                  </span>
                                  {(isModified || isNew) && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {(isModified || isNew) && (
                                  <button
                                    onClick={() => handleResetRow(row.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gold/40 hover:text-gold hover:bg-gold/10 transition-all"
                                    title="Réinitialiser"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteRow(row.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-label-tertiary hover:text-negative hover:bg-negative/10 transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t border-separator bg-bg/95 backdrop-blur-md flex justify-between items-center px-8">
          <div className="flex-1">
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-positive"
                >
                  <div className="w-6 h-6 rounded-full bg-positive/10 flex items-center justify-center">
                    <Check size={14} />
                  </div>
                  <span className="text-caption font-semibold">Modifications enregistrées</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-8 py-4 rounded-xl text-caption font-semibold text-white/40 hover:text-white hover:bg-white/5 transition-all"
            >
              Fermer
            </button>
            <button
              disabled={!hasChanges || hasDuplicateDates || saveLoading}
              onClick={handleSave}
              className={`min-w-[200px] h-12 rounded-xl text-caption font-semibold flex items-center justify-center gap-2 transition-all ${
                !hasChanges || hasDuplicateDates || saveLoading
                  ? 'bg-white/5 text-label-tertiary cursor-not-allowed border border-separator'
                  : 'bg-gold text-bg shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {saveLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  Sauvegarder les modifications
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
