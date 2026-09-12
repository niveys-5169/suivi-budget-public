import React, { useState, useMemo } from 'react';
import { FileUp, AlertTriangle, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { parseHistoryFile, type ParsedHistoryRow } from '../../utils/positionsHistoryExcel';
import type { WealthHistoryEntry } from '../../types/patrimoine';
import { fmt } from '../../utils/format';
import { withRetry } from '../../utils/withRetry';

interface MPositionsImportModalProps {
  existingHistory: WealthHistoryEntry[];
  onClose: () => void;
}

export const MPositionsImportModal: React.FC<MPositionsImportModalProps> = ({
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
      setError('Format invalide ou fichier corrompu.');
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
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Importer historique (Excel)" variant="sheet" size="md">
      <div className="flex flex-col">
        {/* Content */}
        <div className="p-4 space-y-6">
          {!file ? (
            <label
              htmlFor="m-excel-upload"
              aria-label="Choisir un fichier Excel"
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-separator rounded-lg bg-surface active:bg-white/[0.05] transition cursor-pointer"
            >
              <div className="flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-full bg-gold/10 text-gold mb-4">
                  <FileSpreadsheet size={28} />
                </div>
                <p className="text-footnote font-bold text-white">Choisir un fichier .xlsx</p>
                <p className="text-caption text-label-tertiary mt-2">
                  Format requis : ID Actif, Date, Montant
                </p>
              </div>
              <input
                id="m-excel-upload"
                type="file"
                className="hidden"
                accept=".xlsx"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.05] border border-separator">
              <div className="flex items-center gap-4">
                <FileSpreadsheet size={20} className="text-gold" />
                <div className="min-w-0">
                  <p className="text-footnote font-bold text-white truncate">{file.name}</p>
                  <p className="text-caption text-label-tertiary">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                }}
                className="p-2 text-label-secondary"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-negative/10 border border-negative/20 flex items-start gap-2">
              <AlertTriangle className="text-negative shrink-0 mt-1" size={14} />
              <p className="text-footnote text-negative/90 font-medium">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="animate-spin text-gold" size={24} />
              <p className="text-caption text-label-tertiary font-bold">Analyse...</p>
            </div>
          )}

          {!loading && parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-4 rounded-xl bg-surface border border-separator flex flex-col items-center">
                  <span className="text-caption text-label-tertiary font-semibold">Nouveaux</span>
                  <span className="text-headline font-bold text-positive">{stats.creates}</span>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-separator flex flex-col items-center">
                  <span className="text-caption text-label-tertiary font-semibold">Maj</span>
                  <span className="text-headline font-bold text-warning">{stats.updates}</span>
                </div>
                <div className="p-4 rounded-xl bg-surface border border-separator flex flex-col items-center">
                  <span className="text-caption text-label-tertiary font-semibold">Erreurs</span>
                  <span className="text-headline font-bold text-negative">{stats.errors}</span>
                </div>
              </div>

              {/* Mini Preview */}
              <div className="rounded-xl border border-separator bg-black/20 overflow-hidden">
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-separator">
                      {parsedRows.slice(0, 50).map((row, i) => {
                        const hasError = row._errors.length > 0;
                        return (
                          <tr key={i} className={`text-caption ${hasError ? 'bg-negative/5' : ''}`}>
                            <td className="p-2 text-label-tertiary tabular-nums">{row.date}</td>
                            <td className="p-2 text-white font-bold truncate max-w-[120px]">
                              <div>{row.nom || row.assetId}</div>
                              {hasError && (
                                <div className="text-caption text-negative font-medium mt-1">
                                  {row._errors.join(', ')}
                                </div>
                              )}
                            </td>
                            <td
                              className={`p-2 text-right font-semibold tabular-nums ${hasError ? 'text-label-tertiary' : 'text-gold'}`}
                            >
                              {fmt(row.montant)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-4 border-t border-separator bg-bg/95 backdrop-blur-md flex gap-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-xl bg-white/5 text-caption font-bold text-white"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={stats.valid === 0 || importing}
            className="flex-[1.5] py-4 rounded-xl bg-gold text-bg text-caption font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {importing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <FileUp size={16} />
                Valider ({stats.valid})
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
