import type { WorkBook } from '@e965/xlsx';
import type { WealthHistoryEntry } from '../types/patrimoine';

/**
 * En-têtes FR <=> Clés internes
 */
export const HISTORY_COLUMNS = [
  { header: 'ID Actif', key: 'assetId' },
  { header: 'Nom', key: 'nom' },
  { header: 'Date (AAAA-MM-JJ)', key: 'date' },
  { header: 'Montant', key: 'montant' },
  { header: 'Type', key: 'type' },
  { header: 'Propriétaire', key: 'owner' },
  { header: 'Source', key: 'source' },
] as const;

export interface ParsedHistoryRow {
  assetId: string;
  nom: string;
  date: string;
  montant: number;
  type: string;
  owner: string;
  source: string;
  _errors: string[];
}

/**
 * Normalise une valeur de montant vers un nombre.
 * Gère les séparateurs de milliers (espace) et décimaux (virgule).
 */
export function normalizeMontant(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string' || !val.trim()) return NaN;

  // Nettoyage : enlève espaces, remplace virgule par point
  const cleaned = val.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return num;
}

/**
 * Normalise une date Excel ou texte vers YYYY-MM-DD.
 */
export function normalizeDate(val: unknown): string {
  if (val instanceof Date) {
    return val.toISOString().split('T')[0]!;
  }
  if (typeof val === 'number') {
    // Cas du sérial Excel (nombre de jours depuis 1900)
    // SheetJS gère ça via cellDates: true, mais si on a un nombre brut :
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0]!;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Format attendu AAAA-MM-JJ
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Tentative de parsing JS
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]!;
  }
  return '';
}

/**
 * Construit un Workbook SheetJS à partir de l'historique.
 */
export async function buildHistoryWorkbook(entries: WealthHistoryEntry[]): Promise<WorkBook> {
  const XLSX = await import('@e965/xlsx');
  const data = entries.map((e) => {
    const row: Record<string, unknown> = {};
    HISTORY_COLUMNS.forEach((col) => {
      let val = e[col.key];
      // Cas particuliers de mapping si les noms divergent
      if (col.key === 'montant') val = e.montant ?? e.amount ?? e.value;
      if (col.key === 'assetId') val = e.assetId ?? e.placementId;

      row[col.header] = val ?? '';
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: HISTORY_COLUMNS.map((c) => c.header) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historique Positions');

  return wb;
}

/**
 * Lit un fichier Excel et retourne les lignes brutes.
 */
export async function parseHistoryFile(file: File): Promise<ParsedHistoryRow[]> {
  const XLSX = await import('@e965/xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        const rows = XLSX.utils.sheet_to_json(ws);
        resolve(parseHistoryRows(rows));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Mappe les colonnes FR vers les clés internes et normalise.
 */
export function parseHistoryRows(rows: unknown[]): ParsedHistoryRow[] {
  return (rows as Record<string, unknown>[]).map((row) => {
    const errors: string[] = [];

    // Mappage par header (robuste aux espaces et à la casse)
    const findValue = (key: string) => {
      const col = HISTORY_COLUMNS.find((c) => c.key === key);
      if (!col) return undefined;
      const rowKey = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === col.header.trim().toLowerCase(),
      );
      return rowKey ? row[rowKey] : undefined;
    };

    const assetId = String(findValue('assetId') || '').trim();
    if (!assetId) errors.push('ID Actif manquant');

    const rawDate = findValue('date');
    const date = normalizeDate(rawDate);
    if (!date) errors.push('Date invalide ou manquante');

    const rawMontant = findValue('montant');
    const montant = normalizeMontant(rawMontant);
    if (rawMontant === undefined || rawMontant === null || isNaN(montant)) {
      errors.push('Montant invalide');
    }

    return {
      assetId,
      nom: String(findValue('nom') || '').trim(),
      date,
      montant,
      type: String(findValue('type') || 'other').trim(),
      owner: String(findValue('owner') || 'Commun').trim(),
      source: String(findValue('source') || 'historical_excel').trim(),
      _errors: errors,
    };
  });
}

/**
 * Déclenche le téléchargement du workbook.
 */
export async function downloadWorkbook(wb: WorkBook, filename: string) {
  const XLSX = await import('@e965/xlsx');
  XLSX.writeFile(wb, filename);
}

/**
 * Export complet de l'historique vers un fichier Excel.
 */
export async function exportPlacementHistory(entries: WealthHistoryEntry[]) {
  const wb = await buildHistoryWorkbook(entries);
  const date = new Date().toISOString().split('T')[0]!;
  await downloadWorkbook(wb, `positions-historique-${date}.xlsx`);
}
