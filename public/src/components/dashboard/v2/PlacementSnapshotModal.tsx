import React, { useState, useRef } from 'react';
import { CHART_COLORS } from '../../../lib/colors';
import { Clock, Save, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../shared/Modal';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { normalizeType, savingsAssetId, courantAssetId } from '../../../utils/wealthTimeline';
import { formatCurrency } from '../../../lib/formatters';
import { parseDecimal } from '../../../utils/format';
import { withRetry } from '../../../utils/withRetry';

interface PlacementOption {
  id: string;
  nom: string;
  type: string;
  owner?: string;
  montant?: number;
}

interface Props {
  placements: PlacementOption[];
  existingHistory?: { assetId?: string; date?: string }[];
  onClose: () => void;
  onOpenHistory?: () => void;
}

type SnapshotMode = 'existing' | 'manual';

interface SnapshotRow {
  key: string;
  mode: SnapshotMode;
  selectedId: string;
  manualNom: string;
  manualType: string;
  manualOwner: string;
  date: string;
  montant: string;
}

const TYPE_OPTIONS = [
  { value: 'savings', label: 'Épargne / Livret' },
  { value: 'cash', label: 'Liquidités' },
  { value: 'market', label: 'Bourse / Market' },
  { value: 'retirement', label: 'PER / Retraite' },
  { value: 'other', label: 'Autre' },
];

const OWNER_OPTIONS = ['Nicolas', 'Romane', 'Sienna', 'Gwen', 'Commun'];

export const PlacementSnapshotModal: React.FC<Props> = ({
  placements,
  existingHistory,
  onClose,
  onOpenHistory,
}) => {
  const hasOptions = placements.length > 0;
  const rowCounter = useRef(1);
  const defaultDate = new Date().toISOString().split('T')[0]!;

  const createRow = (keySuffix: number): SnapshotRow => ({
    key: `snapshot-row-${keySuffix}`,
    mode: hasOptions ? 'existing' : 'manual',
    selectedId: placements[0]?.id || '',
    manualNom: '',
    manualType: 'savings',
    manualOwner: 'Nicolas',
    date: defaultDate,
    montant: '',
  });

  const [rows, setRows] = useState<SnapshotRow[]>([createRow(0)]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);

  const categoryColors: Record<string, string> = {
    courants: CHART_COLORS.emerald,
    epargne: CHART_COLORS.gold,
    portefeuille: '#3B82F6',
    retirement: '#8B5CF6',
    placements: '#94A3B8',
  };

  const updateRow = (key: string, patch: Partial<SnapshotRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createRow(rowCounter.current++)]);
  };

  const normalizeRowType = (type: string) => normalizeType(type);

  const validateRow = (row: SnapshotRow) => {
    const hasAmount = parseDecimal(row.montant) !== null;
    const hasDate = Boolean(row.date);
    const hasAsset =
      row.mode === 'existing' ? Boolean(row.selectedId) : Boolean(row.manualNom.trim());
    return hasAmount && hasDate && hasAsset;
  };

  const validRows = rows.filter(validateRow);

  const getSelectedPlacement = (row: SnapshotRow) =>
    placements.find((p) => p.id === row.selectedId);

  // Check for duplicates within the session
  const getRowKey = (row: SnapshotRow): string => {
    const selected = getSelectedPlacement(row);
    let assetId: string;
    if (row.mode === 'existing' && selected) {
      const owner = selected.owner || 'Commun';
      if (selected.type === 'savings') {
        assetId = savingsAssetId(owner, selected.nom);
      } else if (selected.type === 'cash') {
        assetId = courantAssetId(owner, selected.nom);
      } else {
        assetId = selected.id;
      }
    } else {
      assetId = row.manualNom.trim().toLowerCase().replace(/\s+/g, '_');
    }
    return `${assetId}|${row.date}`;
  };

  const sessionDuplicates = new Set<string>();
  const seenInSession = new Set<string>();
  validRows.forEach((row) => {
    const key = getRowKey(row);
    if (seenInSession.has(key)) {
      sessionDuplicates.add(key);
    }
    seenInSession.add(key);
  });

  const hasDuplicatesInSession = sessionDuplicates.size > 0;
  const canSubmit = validRows.length > 0 && !loading && !hasDuplicatesInSession;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validRows.length === 0 || hasDuplicatesInSession) return;

    // Build a set of (assetId|date) combos that already exist in history
    const existingKeys = new Set(
      (existingHistory || [])
        .filter((h) => h.assetId && h.date)
        .map((h) => `${h.assetId}|${h.date}`),
    );

    setLoading(true);
    try {
      const batch = writeBatch(db);
      let skipped = 0;

      validRows.forEach((row) => {
        const selected = getSelectedPlacement(row);
        let assetId: string;

        const type = row.mode === 'existing' && selected ? selected.type : row.manualType;
        const owner =
          row.mode === 'existing' && selected ? selected.owner || 'Commun' : row.manualOwner;

        if (row.mode === 'existing' && selected) {
          if (selected.type === 'savings') {
            assetId = savingsAssetId(owner, selected.nom);
          } else if (selected.type === 'cash') {
            assetId = courantAssetId(owner, selected.nom);
          } else {
            assetId = selected.id;
          }
        } else {
          assetId = row.manualNom.trim().toLowerCase().replace(/\s+/g, '_');
        }

        if (!assetId) return;

        if (existingKeys.has(`${assetId}|${row.date}`)) {
          skipped++;
          return;
        }

        const entryId = `${assetId}_${row.date}`;
        batch.set(doc(db, 'placement_history', entryId), {
          assetId,
          montant: parseDecimal(row.montant) ?? 0,
          date: row.date,
          type,
          owner,
          source: 'historical_manual',
        });
      });

      await withRetry(() => batch.commit());
      setSkippedCount(skipped);
      setSuccess(true);
      setRows([createRow(rowCounter.current++)]);
      setTimeout(() => {
        setSuccess(false);
        setSkippedCount(0);
      }, 3000);
    } catch (err) {
      console.error('Error saving snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  const historyAction = onOpenHistory ? (
    <button
      type="button"
      onClick={onOpenHistory}
      className="flex items-center gap-2 px-4 min-h-[44px] rounded-control bg-white/5 border border-separator text-white/60 hover:text-white hover:bg-white/10 transition-all text-caption font-semibold"
    >
      <Clock size={14} className="text-gold" />
      <span className="hidden sm:inline">Gérer l&apos;historique</span>
    </button>
  ) : undefined;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Snapshot Historique"
      subtitle="Ajouter plusieurs snapshots dans une même session"
      size="lg"
      headerActions={historyAction}
      variant="centered"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {rows.map((row, index) => {
          const selected = getSelectedPlacement(row);
          const effectiveType =
            row.mode === 'existing' ? selected?.type || 'savings' : row.manualType;
          const categoryLabel = normalizeRowType(effectiveType);
          const color = categoryColors[categoryLabel] || CHART_COLORS.gold;

          return (
            <div
              key={row.key}
              className="rounded-lg border border-separator bg-white/5 p-4 space-y-4"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                  {hasOptions && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateRow(row.key, { mode: 'existing' })}
                        className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-all ${
                          row.mode === 'existing' ? 'bg-white/10 text-white' : 'text-white/30'
                        }`}
                      >
                        Actif existant
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRow(row.key, { mode: 'manual' })}
                        className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-all ${
                          row.mode === 'manual' ? 'bg-white/10 text-white' : 'text-white/30'
                        }`}
                      >
                        Saisie libre
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-caption text-white/40">Ligne {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-caption font-semibold text-white/40 transition hover:bg-white/10"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </div>

              {row.mode === 'existing' && hasOptions && (
                <div className="space-y-2">
                  <label
                    htmlFor={`asset-select-${row.key}`}
                    className="text-caption font-semibold text-white/40"
                  >
                    Actif
                  </label>
                  <select
                    id={`asset-select-${row.key}`}
                    value={row.selectedId}
                    onChange={(e) => updateRow(row.key, { selectedId: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors appearance-none"
                  >
                    {placements.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#1A1A24]">
                        {p.nom} — {p.owner || 'Commun'}
                      </option>
                    ))}
                  </select>
                  {selected && (
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-caption font-bold" style={{ color }}>
                        {categoryLabel}
                      </span>
                      {selected.montant !== undefined && (
                        <span className="text-caption text-label-tertiary ml-auto">
                          Actuel : {formatCurrency(selected.montant)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {row.mode === 'manual' && (
                <>
                  <div className="space-y-2">
                    <label
                      htmlFor={`manual-nom-${row.key}`}
                      className="text-caption font-semibold text-white/40"
                    >
                      Nom du compte / actif
                    </label>
                    <input
                      id={`manual-nom-${row.key}`}
                      type="text"
                      value={row.manualNom}
                      placeholder="ex : Livret A, LEP, Assurance Vie..."
                      onChange={(e) => updateRow(row.key, { manualNom: e.target.value })}
                      className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors placeholder:text-label-tertiary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor={`manual-type-${row.key}`}
                        className="text-caption font-semibold text-white/40"
                      >
                        Type
                      </label>
                      <select
                        id={`manual-type-${row.key}`}
                        value={row.manualType}
                        onChange={(e) => updateRow(row.key, { manualType: e.target.value })}
                        className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors appearance-none"
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} className="bg-[#1A1A24]">
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor={`manual-owner-${row.key}`}
                        className="text-caption font-semibold text-white/40"
                      >
                        Propriétaire
                      </label>
                      <select
                        id={`manual-owner-${row.key}`}
                        value={row.manualOwner}
                        onChange={(e) => updateRow(row.key, { manualOwner: e.target.value })}
                        className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors appearance-none"
                      >
                        {OWNER_OPTIONS.map((owner) => (
                          <option key={owner} value={owner} className="bg-[#1A1A24]">
                            {owner}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor={`date-${row.key}`}
                    className="text-caption font-semibold text-white/40"
                  >
                    Date
                  </label>
                  <input
                    id={`date-${row.key}`}
                    type="date"
                    value={row.date}
                    max={defaultDate}
                    onChange={(e) => updateRow(row.key, { date: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={`montant-${row.key}`}
                    className="text-caption font-semibold text-white/40"
                  >
                    Valeur (€)
                  </label>
                  <input
                    id={`montant-${row.key}`}
                    type="text"
                    inputMode="decimal"
                    value={row.montant}
                    placeholder="0"
                    onChange={(e) => updateRow(row.key, { montant: e.target.value })}
                    className="w-full h-12 bg-white/5 border border-separator rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-4 text-caption font-semibold text-white transition hover:bg-white/10"
          >
            <Plus size={16} /> Ajouter un snapshot
          </button>
          <span className="text-caption text-white/30">
            Tu peux ajouter plusieurs lignes puis tout enregistrer en une fois.
          </span>
        </div>

        {rows.some((row) => !validateRow(row)) && (
          <p className="text-caption text-white/50">
            Les lignes incomplètes ne seront pas enregistrées tant qu&apos;elles ne sont pas
            complètes.
          </p>
        )}

        {hasDuplicatesInSession && (
          <p className="text-caption text-negative bg-negative/10 border border-negative/20 rounded-xl p-4">
            ⚠️ Doublons détectés : vous avez le même actif avec la même date plusieurs fois.
            Supprimez les lignes dupliquées avant de continuer.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full h-12 rounded-xl font-semibold text-caption flex items-center justify-center gap-4 transition-all disabled:opacity-40 ${
            success
              ? 'bg-positive text-white'
              : 'bg-gold text-bg hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          <Save size={16} />
          {success
            ? skippedCount > 0
              ? `Enregistrés ✓ — ${skippedCount} ignoré${skippedCount > 1 ? 's' : ''} (date déjà existante)`
              : 'Snapshots enregistrés ✓'
            : loading
              ? 'Enregistrement...'
              : 'Enregistrer les snapshots'}
        </button>
      </form>
    </Modal>
  );
};
