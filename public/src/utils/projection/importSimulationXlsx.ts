import type { WorkBook } from '@e965/xlsx';
import type { ProjectionImportResult, ProjectionParams } from '../../types/banking.types';
import { importCalcScenarios } from './importCalcScenarios';
import { importCalculateurs } from './importCalculateurs';
import { importHypotheses } from './importHypotheses';
import { importRevenusFoyer } from './importRevenusFoyer';
import { importTableauDeBord } from './importTableauDeBord';
import type { ImportContext } from './importContext';

/**
 * Importe le classeur de simulation (valeurs en cache) dans des paramètres de projection.
 * Pur : `base` n'est pas modifié ; tout élément introuvable donne un avertissement
 * et conserve la valeur de `base`.
 */
export function importSimulationWorkbook(
  wb: WorkBook,
  base: ProjectionParams,
): ProjectionImportResult {
  const ctx: ImportContext = { params: structuredClone(base), reconnus: [], avertissements: [] };
  importHypotheses(wb, ctx);
  const finActivite = importRevenusFoyer(wb, ctx);
  const metas = importCalcScenarios(wb, ctx, finActivite);
  importTableauDeBord(wb, ctx, metas, finActivite);
  importCalculateurs(wb, ctx);
  return { params: ctx.params, reconnus: ctx.reconnus, avertissements: ctx.avertissements };
}

/** Lit un fichier .xlsx (navigateur) puis l'importe. SheetJS est chargé à la demande. */
export async function importSimulationXlsx(
  data: ArrayBuffer,
  base: ProjectionParams,
): Promise<ProjectionImportResult> {
  const XLSX = await import('@e965/xlsx');
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  return importSimulationWorkbook(wb, base);
}
