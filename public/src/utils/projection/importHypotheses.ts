import type { WorkBook } from '@e965/xlsx';
import type { ProjectionAutoValue, ProjectionPointAConfirmer } from '../../types/banking.types';
import { importCredits, importExceptionnelles } from './importHypothesesCredits';
import { recognized, setPersonne, takeNumber, warn, type ImportContext } from './importContext';
import {
  asDay,
  asNumber,
  findRow,
  findRows,
  findSheet,
  readRows,
  slugify,
  type RowMatch,
  type SheetRow,
} from './xlsxSheetReader';

const ARRET_ALLOCATIONS_AGE = 20;

/** Renseigne la valeur manuelle en conservant le mode (auto/manuel) courant. */
function withManuel(current: ProjectionAutoValue, value: number | undefined): ProjectionAutoValue {
  return value === undefined ? current : { mode: current.mode, manuel: value };
}

function importEnfants(rows: SheetRow[], ctx: ImportContext): void {
  const found = findRows(rows, { starts: "date de naissance de l'enfant" });
  const enfants = found.flatMap((row, i) => {
    const dateNaissance = asDay(row.cells[2]);
    if (!dateNaissance) return [];
    recognized(ctx, row.label);
    return [{ id: `enfant-${i + 1}`, dateNaissance }];
  });
  if (enfants.length === 0)
    warn(ctx, 'Dates de naissance des enfants introuvables : enfants conservés.');
  else ctx.params.enfants = enfants;
}

function importAConfirmer(rows: SheetRow[], ctx: ImportContext): void {
  const used = new Set<string>();
  ctx.params.aConfirmer = rows.flatMap((row): ProjectionPointAConfirmer[] => {
    const commentaire = row.cells[4];
    if (typeof commentaire !== 'string' || !commentaire.includes('⚠️')) return [];
    let id = slugify(row.label) || `point-${row.index}`;
    while (used.has(id)) id = `${id}-${row.index}`;
    used.add(id);
    return [{ id, libelle: row.label, commentaire: commentaire.trim() }];
  });
}

/** Onglet « Hypothèses » : libellé col. B, valeur col. C, commentaire col. E. */
export function importHypotheses(wb: WorkBook, ctx: ImportContext): void {
  const ws = findSheet(wb, 'hypotheses');
  if (!ws) {
    warn(ctx, 'Onglet « Hypothèses » introuvable : paramètres conservés.');
    return;
  }
  const rows = readRows(ws, 1, 5);
  const params = ctx.params;
  const num = (name: string, m: RowMatch) => takeNumber(ctx, findRow(rows, m), name);

  const retraite = num('Âge de départ à la retraite', { starts: 'age de depart a la retraite' });
  if (retraite !== undefined) setPersonne(ctx, 0, { ageFinActivite: retraite });
  const finActivite = num("Âge de fin d'activité", { starts: "age de fin d'activite" });
  if (finActivite !== undefined) setPersonne(ctx, 1, { ageFinActivite: finActivite });

  const caf = params.revenusCommuns.caf;
  caf.montant = withManuel(caf.montant, num('CAF', { starts: 'caf (' }));
  caf.evolutionAnnuelle =
    num('Évolution de la CAF', { starts: 'evolution annuelle de la caf' }) ?? caf.evolutionAnnuelle;
  const arret = findRow(rows, { starts: 'arret des allocations familiales' });
  if (arret) {
    caf.arretAuxAnsAine = asNumber(arret.cells[2]) === 1 ? ARRET_ALLOCATIONS_AGE : undefined;
    recognized(ctx, arret.label);
  } else warn(ctx, 'Arrêt des allocations familiales introuvable : valeur conservée.');
  importEnfants(rows, ctx);

  const { macro } = params;
  macro.inflation = num('Inflation', { starts: 'inflation' }) ?? macro.inflation;
  macro.rendementCapital =
    num('Rendement du capital', { contains: ['rendement', 'capital'], excludes: ['patrimoine'] }) ??
    macro.rendementCapital;
  macro.rendementPatrimoine =
    num('Rendement du patrimoine', { contains: ['rendement', 'patrimoine'] }) ??
    macro.rendementPatrimoine;

  const { depenses, capital } = params;
  depenses.budgetReference = withManuel(
    depenses.budgetReference,
    num('Budget de référence', { starts: 'budget mensuel de reference' }),
  );
  capital.patrimoineDepart = withManuel(
    capital.patrimoineDepart,
    num('Patrimoine de départ', { starts: 'patrimoine hors per de depart' }),
  );
  const abondement = num('Abondement annuel', { starts: 'abondement annuel' });
  if (abondement !== undefined) {
    capital.abondement = { mois: 1, ...capital.abondement, montantAnnuel: abondement };
  }

  importCredits(rows, ctx);
  importExceptionnelles(ws, rows, ctx);
  importAConfirmer(rows, ctx);
}
