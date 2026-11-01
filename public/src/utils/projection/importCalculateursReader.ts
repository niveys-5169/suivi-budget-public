import type { WorkBook, WorkSheet } from '@e965/xlsx';
import { warn, type ImportContext } from './importContext';
import {
  asDay,
  asNumber,
  findRows,
  findSheet,
  readRows,
  type RowMatch,
  type SheetRow,
} from './xlsxSheetReader';

/** Onglets de saisie des calculateurs : texte du nom (normalisé) et colonne de libellé (0 = A, 1 = B). */
const ONGLETS = {
  hyp: { needle: 'hypotheses', labelCol: 1 },
  rupture: { needle: 'rupture', labelCol: 0 },
  foyer: { needle: 'revenus foyer', labelCol: 0 },
  liberal: { needle: 'mjpm liberal', labelCol: 0 },
  salarie: { needle: 'mjpm salarie', labelCol: 0 },
  sam: { needle: 'sam par scenario', labelCol: 0 },
  are: { needle: 'calcul & simulation', labelCol: 0 },
  pas: { needle: 'calcul taux pas', labelCol: 0 },
} as const;

export type OngletId = keyof typeof ONGLETS;

interface Onglet {
  ws: WorkSheet;
  rows: SheetRow[];
  labelCol: number;
}

/** Lecteur de paramètres par libellé : onglets chargés à la demande, avertissement à la 1re absence. */
export interface Lecteur {
  ctx: ImportContext;
  wb: WorkBook;
  cache: Map<OngletId, Onglet | null>;
}

export function creerLecteur(wb: WorkBook, ctx: ImportContext): Lecteur {
  return { ctx, wb, cache: new Map() };
}

/** Noms (normalisés) des onglets de saisie absents du classeur. */
export function ongletsManquants(wb: WorkBook): string[] {
  return Object.values(ONGLETS)
    .filter(({ needle }) => !findSheet(wb, needle))
    .map(({ needle }) => needle);
}

export function onglet(l: Lecteur, id: OngletId): Onglet | undefined {
  if (!l.cache.has(id)) {
    const { needle, labelCol } = ONGLETS[id];
    const ws = findSheet(l.wb, needle);
    l.cache.set(id, ws ? { ws, rows: readRows(ws, labelCol, 8), labelCol } : null);
  }
  return l.cache.get(id) ?? undefined;
}

/** Toutes les lignes d'un onglet correspondant au critère, dans l'ordre du classeur. */
export function lignes(l: Lecteur, id: OngletId, match: RowMatch): SheetRow[] {
  const o = onglet(l, id);
  return o ? findRows(o.rows, match) : [];
}

interface Option {
  /** Rang parmi les lignes correspondantes (libellés répétés pour les deux personnes). */
  nth?: number;
  /** Colonne de la valeur (0 = A) ; par défaut, la colonne qui suit le libellé. */
  col?: number;
}

function cellule(l: Lecteur, id: OngletId, match: RowMatch, nom: string, opt: Option = {}) {
  const row = lignes(l, id, match)[opt.nth ?? 0];
  if (!row) warn(l.ctx, `Calculateurs : « ${nom} » introuvable, valeur à 0.`);
  return row?.cells[opt.col ?? onglet(l, id)!.labelCol + 1];
}

export function nombre(l: Lecteur, id: OngletId, match: RowMatch, nom: string, opt?: Option) {
  if (!onglet(l, id)) return 0;
  return asNumber(cellule(l, id, match, nom, opt)) ?? 0;
}

export function jour(l: Lecteur, id: OngletId, match: RowMatch, nom: string, opt?: Option) {
  if (!onglet(l, id)) return '';
  return asDay(cellule(l, id, match, nom, opt)) ?? '';
}
