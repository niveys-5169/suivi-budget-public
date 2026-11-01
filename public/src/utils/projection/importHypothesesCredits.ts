import type { WorkSheet } from '@e965/xlsx';
import type { ProjectionCreditParam, ProjectionMontantDate } from '../../types/banking.types';
import { recognized, warn, type ImportContext } from './importContext';
import {
  asMonth,
  asNumber,
  findRow,
  findRows,
  normalizeLabel,
  readCell,
  slugify,
  type SheetRow,
} from './xlsxSheetReader';

/** Clé normalisée du crédit désigné par un libellé « … crédit X ». */
function creditKeyOf(row: SheetRow): string | undefined {
  return /\bcredit (.+)$/.exec(row.norm)?.[1];
}

function findForCredit(rows: SheetRow[], starts: string, key: string): SheetRow | undefined {
  return rows.find((r) => r.norm.startsWith(normalizeLabel(starts)) && creditKeyOf(r) === key);
}

/** Crédits (« Fin du crédit X »), taux nominaux et remboursements anticipés. */
export function importCredits(rows: SheetRow[], ctx: ImportContext): void {
  const fins = findRows(rows, { starts: 'fin du credit ' });
  if (fins.length === 0) {
    warn(ctx, 'Fins de crédit (« Fin du crédit … ») introuvables : crédits conservés.');
    return;
  }
  const flagRow = findRow(rows, { starts: 'remboursement anticipe' });
  const flag = flagRow ? asNumber(flagRow.cells[2]) : undefined;
  if (flagRow) recognized(ctx, flagRow.label);
  else warn(ctx, 'Drapeau de remboursement anticipé introuvable : aucun remboursement repris.');

  ctx.params.depenses.credits = fins.map((row): ProjectionCreditParam => {
    const libelle = row.label.replace(/^.*?fin du cr[eé]dit\s+/i, '').trim();
    const key = normalizeLabel(libelle);
    const credit: ProjectionCreditParam = {
      id: `credit-${slugify(libelle)}`,
      libelle,
      mode: 'manuel',
    };
    const fin = asMonth(row.cells[2]);
    if (fin) {
      credit.finManuelle = fin;
      recognized(ctx, row.label);
    } else warn(ctx, `${row.label} : date illisible.`);

    const tauxRow = findForCredit(rows, 'taux nominal', key);
    const taux = tauxRow ? asNumber(tauxRow.cells[2]) : undefined;
    if (tauxRow && taux !== undefined) {
      credit.tauxAnnuelManuel = Math.round(taux * 100 * 1e6) / 1e6;
      recognized(ctx, tauxRow.label);
    }
    const dateRow = findForCredit(rows, 'date de remboursement anticipe', key);
    const mois = dateRow ? asMonth(dateRow.cells[2]) : undefined;
    if (flag === 1 && dateRow && mois) {
      credit.remboursementAnticipe = { mois };
      recognized(ctx, dateRow.label);
    }
    return credit;
  });
}

/** Dépenses exceptionnelles : lignes entre l'en-tête « Libellé » et « Total des dépenses … ». */
export function importExceptionnelles(ws: WorkSheet, rows: SheetRow[], ctx: ImportContext): void {
  const header = findRow(rows, { starts: 'libelle' });
  const total = findRow(rows, { starts: 'total des depenses exceptionnelles' });
  if (!header || !total) {
    warn(ctx, 'Bloc « Dépenses exceptionnelles » introuvable : dépenses conservées.');
    return;
  }
  const list: ProjectionMontantDate[] = [];
  for (let line = header.index + 1; line < total.index; line += 1) {
    const raw = readCell(ws, line, 1);
    const libelle = typeof raw === 'string' ? raw.trim() : '';
    const montant = asNumber(readCell(ws, line, 2));
    const mois = asMonth(readCell(ws, line, 3));
    if (!libelle && montant === undefined && !mois) continue;
    if (!libelle || montant === undefined || !mois) {
      warn(
        ctx,
        `Dépense exceptionnelle ligne ${line} ignorée (libellé, montant ou mois illisible).`,
      );
      continue;
    }
    list.push({ id: `exceptionnelle-${list.length + 1}`, libelle, montant, mois });
    recognized(ctx, libelle);
  }
  ctx.params.depenses.exceptionnelles = list;
}
