import React, { useState, useMemo } from 'react';
import { FileUp, AlertTriangle, FileSpreadsheet, Loader2, X, Plus, RefreshCw } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { Modal } from '../../shared/Modal';
import { parseHistoryFile, type ParsedHistoryRow } from '../../../utils/positionsHistoryExcel';
import type { WealthHistoryEntry } from '../../../types/patrimoine';
import { fmt } from '../../../utils/format';
import { withRetry } from '../../../utils/withRetry';

interface PositionsImportModalProps {
  existingHistory: WealthHistoryEntry[];
  onClose: () => void;
}

export const PositionsImportModal: React.FC<PositionsImportModalProps> = ({
  existingHistory,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Index des entrées existantes pour détection des écrasements
  const existingIndex = useMemo(() => {
    const index = new Set<string>();
    existingHistory.forEach((h) => {
      const assetId = h.assetId || h.placementId;
      if (assetId && h.date) {
        index.add(`${assetId}|${h.date}`);
      }
    });
    return index;
  }, [existingHistory]);

  const stats = useMemo(() => {
    const total = parsedRows.length;
    let valid = 0;
    let errors = 0;
    let updates = 0;
    let creates = 0;

    parsedRows.forEach((row) => {
      if (row._errors.length > 0) {
        errors++;
      } else {
        valid++;
        if (existingIndex.has(`${row.assetId}|${row.date}`)) {
          updates++;
        } else {
          creates++;
        }
      }
    });

    return { total, valid, errors, updates, creates };
  }, [parsedRows, existingIndex]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    try {
      const rows = await parseHistoryFile(selectedFile);
      setParsedRows(rows);
    } catch (err: unknown) {
      console.error('Erreur parsing Excel:', err);
      setError('Impossible de lire le fichier Excel. Vérifiez le format.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (stats.valid === 0) return;

    setImporting(true);
    try {
      const batch = writeBatch(db);
      const validRows = parsedRows.filter((r) => r._errors.length === 0);

      validRows.forEach((row) => {
        const docId = `${row.assetId}_${row.date}`;
        const docRef = doc(db, 'placement_history', docId);

        batch.set(
          docRef,
          {
            assetId: row.assetId,
            nom: row.nom,
            date: row.date,
            montant: row.montant,
            type: row.type,
            owner: row.owner,
            source: 'historical_excel',
            updatedAt: new Date(),
          },
          { merge: true },
        );
      });

      await withRetry(() => batch.commit());
      onClose();
    } catch (err: unknown) {
      console.error('Erreur import Firestore:', err);
      setError("Erreur lors de l'enregistrement dans la base de données.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Importer l'historique (Excel)" size="lg">
      <div className="space-y-6">
        {/* Zone d'upload */}
        {!file ? (
          <label
            htmlFor="excel-upload"
            aria-label="Sélectionner un fichier Excel"
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-separator rounded-xl bg-surface hover:bg-white/[0.04] transition cursor-pointer group"
          >
            <div className="flex flex-col items-center justify-center pt-4 pb-6 text-center px-4">
              <div className="p-4 rounded-full bg-gold/10 text-gold mb-4 group-hover:scale-110 transition">
                <FileSpreadsheet size={32} />
              </div>
              <p className="text-lg font-semibold text-white mb-2">Sélectionner un fichier Excel</p>
              <p className="text-sm text-label-tertiary max-w-sm">
                Utilisez l&apos;export comme modèle. Les colonnes ID Actif, Date et Montant sont
                obligatoires.
              </p>
            </div>
            <input
              id="excel-upload"
              type="file"
              className="hidden"
              accept=".xlsx"
              onChange={handleFileChange}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.05] border border-separator">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl bg-gold/10 text-gold">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <p className="font-bold text-white">{file.name}</p>
                <p className="text-xs text-label-tertiary">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setParsedRows([]);
              }}
              className="p-2 hover:bg-white/10 rounded-full transition text-label-secondary"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-negative/10 border border-negative/20 flex items-start gap-4">
            <AlertTriangle className="text-negative shrink-0 mt-1" size={18} />
            <p className="text-sm text-negative">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="animate-spin text-gold" size={32} />
            <p className="text-label-tertiary font-bold text-xs">Analyse du fichier...</p>
          </div>
        )}

        {/* Statistiques et Preview */}
        {!loading && parsedRows.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-surface border border-separator flex flex-col gap-1">
                <p className="text-caption text-label-tertiary font-semibold">Nouvelles</p>
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-positive" />
                  <span className="text-xl font-semibold text-white">{stats.creates}</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface border border-separator flex flex-col gap-1">
                <p className="text-caption text-label-tertiary font-semibold">Écrasées</p>
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-warning" />
                  <span className="text-xl font-semibold text-white">{stats.updates}</span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-surface border border-separator flex flex-col gap-1">
                <p className="text-caption text-label-tertiary font-semibold">Erreurs</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-negative" />
                  <span className="text-xl font-semibold text-white">{stats.errors}</span>
                </div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="max-h-[300px] overflow-auto rounded-lg border border-separator bg-black/20">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr>
                    <th className="p-4 text-caption font-semibold text-label-tertiary border-b border-separator">
                      Date
                    </th>
                    <th className="p-4 text-caption font-semibold text-label-tertiary border-b border-separator">
                      Nom
                    </th>
                    <th className="p-4 text-caption font-semibold text-label-tertiary border-b border-separator text-right">
                      Montant
                    </th>
                    <th className="p-4 text-caption font-semibold text-label-tertiary border-b border-separator">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {parsedRows.slice(0, 100).map((row, i) => {
                    const isUpdate = existingIndex.has(`${row.assetId}|${row.date}`);
                    const hasError = row._errors.length > 0;

                    return (
                      <tr key={i} className="hover:bg-surface transition-colors">
                        <td className="p-4 text-sm text-label-secondary tabular-nums font-medium">
                          {row.date}
                        </td>
                        <td className="p-4 text-sm text-white font-bold truncate max-w-[200px]">
                          <div>{row.nom || row.assetId}</div>
                          {hasError && (
                            <div className="text-caption text-negative font-medium mt-1">
                              {row._errors.join(', ')}
                            </div>
                          )}
                        </td>
                        <td
                          className={`p-4 text-sm text-right font-semibold tabular-nums ${hasError ? 'text-label-tertiary' : 'text-gold'}`}
                        >
                          {fmt(row.montant)}
                        </td>
                        <td className="p-4">
                          {hasError ? (
                            <span className="text-caption bg-negative/10 text-negative px-2 py-1 rounded-full font-semibold border border-negative/20">
                              Erreur
                            </span>
                          ) : isUpdate ? (
                            <span className="text-caption bg-warning/10 text-warning px-2 py-1 rounded-full font-semibold border border-warning/20">
                              Maj
                            </span>
                          ) : (
                            <span className="text-caption bg-positive/10 text-positive px-2 py-1 rounded-full font-semibold border border-positive/20">
                              Nouveau
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedRows.length > 100 && (
                <div className="p-4 text-center text-xs text-label-tertiary">
                  Affichage des 100 premières lignes sur {parsedRows.length}...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-lg bg-white/5 border border-separator text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={stats.valid === 0 || importing}
            className="flex-[2] px-6 py-4 rounded-lg bg-gold text-bg text-sm font-semibold hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Importation...
              </>
            ) : (
              <>
                <FileUp size={18} />
                Valider l&apos;import ({stats.valid})
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
