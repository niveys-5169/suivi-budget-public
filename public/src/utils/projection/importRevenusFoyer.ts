import type { WorkBook } from '@e965/xlsx';
import type { ProjectionMonth, ProjectionMontantDate } from '../../types/banking.types';
import { recognized, setPersonne, takeNumber, warn, type ImportContext } from './importContext';
import {
  asDay,
  asMonth,
  asNumber,
  findRow,
  findRows,
  findSheet,
  normalizeLabel,
  readRows,
  shiftMonth,
  type SheetRow,
} from './xlsxSheetReader';

function importHorizon(rows: SheetRow[], ctx: ImportContext): void {
  const { horizon } = ctx.params;
  const debut = findRow(rows, { starts: 'premier mois de la projection' });
  const fin = findRow(rows, { starts: 'fin de projection' });
  const annee = takeNumber(
    ctx,
    findRow(rows, { starts: 'annee de reference des prix' }),
    'Année de référence des prix',
    1,
  );
  const moisDebut = debut && asMonth(debut.cells[1]);
  const moisFin = fin && asMonth(fin.cells[1]);
  if (moisDebut) horizon.debut = moisDebut;
  else warn(ctx, 'Premier mois de la projection introuvable : valeur conservée.');
  if (moisFin) horizon.fin = moisFin;
  else warn(ctx, 'Fin de projection introuvable : valeur conservée.');
  if (annee !== undefined) horizon.anneeReferencePrix = annee;
  if (moisDebut && debut) recognized(ctx, debut.label);
  if (moisFin && fin) recognized(ctx, fin.label);
}

function importNaissances(rows: SheetRow[], ctx: ImportContext): void {
  const adultes = findRows(rows, { starts: 'date de naissance de ', excludes: ["l'enfant"] }).slice(
    0,
    2,
  );
  if (adultes.length < 2)
    warn(ctx, 'Dates de naissance des deux adultes introuvables : personnes conservées.');
  adultes.forEach((row, index) => {
    const prenom = row.label.replace(/^.*?date de naissance de\s+/i, '').trim();
    const dateNaissance = asDay(row.cells[1]);
    if (!dateNaissance) return;
    setPersonne(ctx, index, { prenom, dateNaissance });
    recognized(ctx, row.label);
  });
}

function importMensualites(rows: SheetRow[], ctx: ImportContext): void {
  for (const credit of ctx.params.depenses.credits) {
    const wanted = normalizeLabel(`credit ${credit.libelle}`);
    const row = rows.find((r) => r.norm === wanted);
    const montant = row ? asNumber(row.cells[1]) : undefined;
    if (row && montant !== undefined) {
      credit.mensualiteManuelle = montant;
      recognized(ctx, row.label);
    } else warn(ctx, `Mensualité du crédit « ${credit.libelle} » introuvable.`);
  }
}

function importAbondement(
  rows: SheetRow[],
  ctx: ImportContext,
  finActivite?: ProjectionMonth,
): void {
  const { capital } = ctx.params;
  const moisRow = findRow(rows, { starts: "mois de versement de l'abondement" });
  const mois = takeNumber(ctx, moisRow, "Mois de versement de l'abondement", 1);
  if (!capital.abondement) {
    if (mois !== undefined) warn(ctx, 'Abondement : montant annuel introuvable, mois ignoré.');
    return;
  }
  if (mois !== undefined) capital.abondement.mois = mois;
  if (finActivite) capital.abondement.finMois = shiftMonth(finActivite, -1);
}

function importEncaissements(rows: SheetRow[], ctx: ImportContext): void {
  const versements = rows.filter((r) => /^versement [1-4]\b/.test(r.norm));
  const list = versements.flatMap((row, i): ProjectionMontantDate[] => {
    const montant = asNumber(row.cells[1]);
    const mois = asMonth(row.cells[2]);
    if (montant === undefined || !mois) return [];
    recognized(ctx, row.label);
    return [{ id: `encaissement-${i + 1}`, libelle: row.label, montant, mois }];
  });
  if (list.length === 0)
    warn(ctx, "Versements d'indemnités introuvables : encaissements conservés.");
  else ctx.params.capital.encaissements = list;
}

/**
 * Onglet « ①b Revenus foyer & PAS » : libellé col. A, valeur col. B, date col. C.
 * Retourne le mois de fin d'activité de la personne 2 (utile à l'import des phases).
 */
export function importRevenusFoyer(wb: WorkBook, ctx: ImportContext): ProjectionMonth | undefined {
  const ws = findSheet(wb, 'revenus foyer');
  if (!ws) {
    warn(ctx, 'Onglet « ①b Revenus foyer & PAS » introuvable : paramètres conservés.');
    return undefined;
  }
  const rows = readRows(ws, 0, 4);
  importHorizon(rows, ctx);
  importNaissances(rows, ctx);
  importMensualites(rows, ctx);
  const finRow = findRow(rows, { starts: "fin d'activite de " });
  const finActivite = finRow && asMonth(finRow.cells[1]);
  if (finRow && finActivite) recognized(ctx, finRow.label);
  else warn(ctx, "Fin d'activité de la personne 2 introuvable : abondement et phases non bornés.");
  importAbondement(rows, ctx, finActivite);
  importEncaissements(rows, ctx);
  return finActivite;
}
