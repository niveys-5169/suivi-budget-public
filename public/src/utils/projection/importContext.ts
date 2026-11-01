import type { ProjectionParams, ProjectionPersonne } from '../../types/banking.types';
import { asNumber, type SheetRow } from './xlsxSheetReader';

/** Contexte partagé par les modules d'import : paramètres en cours de construction + rapport. */
export interface ImportContext {
  params: ProjectionParams;
  reconnus: string[];
  avertissements: string[];
}

export function recognized(ctx: ImportContext, label: string): void {
  ctx.reconnus.push(label);
}

export function warn(ctx: ImportContext, message: string): void {
  ctx.avertissements.push(message);
}

/** Valeur numérique d'une ligne (colonne `col`), ou avertissement si illisible. */
export function takeNumber(ctx: ImportContext, row: SheetRow | undefined, name: string, col = 2) {
  const value = row ? asNumber(row.cells[col]) : undefined;
  if (value === undefined) warn(ctx, `${name} : introuvable ou illisible, valeur conservée.`);
  else recognized(ctx, row!.label);
  return value;
}

/** Met à jour la personne `index` (0 = personne 1), en la créant au besoin. */
export function setPersonne(ctx: ImportContext, index: number, patch: Partial<ProjectionPersonne>) {
  const fallback = { id: `p${index + 1}`, prenom: `Personne ${index + 1}` };
  ctx.params.personnes[index] = { ...(ctx.params.personnes[index] ?? fallback), ...patch };
}
