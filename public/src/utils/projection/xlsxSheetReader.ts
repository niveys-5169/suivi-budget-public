import type { WorkBook, WorkSheet } from '@e965/xlsx';
import type { ProjectionMonth } from '../../types/banking.types';
import { parseCalendarDate, toCalendarKey } from '../date';
import { toProjectionMonth } from './defaults';

/** Ligne d'un onglet, repérée par le texte de sa colonne de libellé. */
export interface SheetRow {
  index: number; // numéro de ligne 1-based
  label: string;
  norm: string;
  cells: unknown[]; // valeurs en cache, colonne 0 = A
}

/** Critères de recherche d'une ligne (textes comparés après normalisation). */
export interface RowMatch {
  starts?: string;
  contains?: string[];
  excludes?: string[];
}

/** Minuscules, sans accents ni emoji, espaces compressés. */
export function normalizeLabel(text: unknown): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\p{Extended_Pictographic}|\p{So}|\p{No}|‍|️/gu, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Identifiant stable dérivé d'un libellé. */
export function slugify(text: string): string {
  return normalizeLabel(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function encodeColumn(col: number): string {
  let n = col + 1;
  let out = '';
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function lastRowOf(ws: WorkSheet): number {
  const match = /:[A-Z]+(\d+)$/.exec(ws['!ref'] ?? '');
  return match ? Number(match[1]) : 0;
}

/** Valeur en cache (résultat de formule inclus) d'une cellule, indices 0-based. */
export function readCell(ws: WorkSheet, row: number, col: number): unknown {
  return ws[`${encodeColumn(col)}${row}`]?.v;
}

/** Lit toutes les lignes ayant un libellé texte dans `labelCol` (0-based). */
export function readRows(ws: WorkSheet, labelCol: number, width = 8): SheetRow[] {
  const rows: SheetRow[] = [];
  for (let index = 1; index <= lastRowOf(ws); index += 1) {
    const raw = readCell(ws, index, labelCol);
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const cells = Array.from({ length: width }, (_, col) => readCell(ws, index, col));
    rows.push({ index, label: raw.trim(), norm: normalizeLabel(raw), cells });
  }
  return rows;
}

export function matchesRow(row: SheetRow, m: RowMatch): boolean {
  if (m.starts !== undefined && !row.norm.startsWith(normalizeLabel(m.starts))) return false;
  if (m.contains?.some((c) => !row.norm.includes(normalizeLabel(c)))) return false;
  return !m.excludes?.some((c) => row.norm.includes(normalizeLabel(c)));
}

export function findRow(rows: SheetRow[], m: RowMatch): SheetRow | undefined {
  return rows.find((row) => matchesRow(row, m));
}

export function findRows(rows: SheetRow[], m: RowMatch): SheetRow[] {
  return rows.filter((row) => matchesRow(row, m));
}

/** Trouve un onglet par son nom normalisé (égalité d'abord, puis « contient »). */
export function findSheet(wb: WorkBook, needle: string): WorkSheet | undefined {
  const target = normalizeLabel(needle);
  const names = wb.SheetNames.map((name) => ({ name, norm: normalizeLabel(name) }));
  const hit = names.find((n) => n.norm === target) ?? names.find((n) => n.norm.includes(target));
  return hit ? wb.Sheets[hit.name] : undefined;
}

export function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function asDate(v: unknown): Date | undefined {
  const date = typeof v === 'string' ? parseCalendarDate(v.trim()) : v;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined;
}

/** Jour calendaire `YYYY-MM-DD` d'une cellule date. */
export function asDay(v: unknown): string | undefined {
  const date = asDate(v);
  return date ? toCalendarKey(date) : undefined;
}

/** Mois `YYYY-MM` d'une cellule date. */
export function asMonth(v: unknown): ProjectionMonth | undefined {
  const date = asDate(v);
  return date ? toProjectionMonth(date) : undefined;
}

/** Décale un mois `YYYY-MM` (arithmétique entière). */
export function shiftMonth(month: ProjectionMonth, delta: number): ProjectionMonth {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const total = year * 12 + (mon - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
