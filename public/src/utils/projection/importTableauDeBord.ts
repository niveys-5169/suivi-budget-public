import type { WorkBook } from '@e965/xlsx';
import type { ProjectionMonth, ProjectionPension } from '../../types/banking.types';
import type { ScenarioMeta } from './importCalcScenarios';
import { recognized, warn, type ImportContext } from './importContext';
import {
  asNumber,
  findRow,
  findSheet,
  readRows,
  type RowMatch,
  type SheetRow,
} from './xlsxSheetReader';

const FIRST_SCENARIO_COL = 2; // colonne C
const PENSION_ROWS = {
  p1Avant: { starts: 'retraite nette de', contains: ['avant impot'] },
  p1Apres: { starts: 'retraite de', contains: ['apres impot'], excludes: ['foyer'] },
  p2Avant: { starts: 'pension nette de' },
  p2Apres: { starts: 'pension de', contains: ['apres impot'] },
} satisfies Record<string, RowMatch>;

function pensionAt(
  rows: SheetRow[],
  col: number,
  keys: [keyof typeof PENSION_ROWS, keyof typeof PENSION_ROWS],
  ctx: ImportContext,
): { netAvantImpot: number; netApresImpot: number } | undefined {
  const [avantRow, apresRow] = keys.map((k) => findRow(rows, PENSION_ROWS[k]));
  const netAvantImpot = avantRow ? asNumber(avantRow.cells[col]) : undefined;
  const netApresImpot = apresRow ? asNumber(apresRow.cells[col]) : undefined;
  if (netAvantImpot === undefined || netApresImpot === undefined) return undefined;
  recognized(ctx, avantRow!.label);
  recognized(ctx, apresRow!.label);
  return { netAvantImpot, netApresImpot };
}

/**
 * Onglet « Tableau de bord », section 2 : noms des scénarios (ligne « Poste », colonnes C…G)
 * et pensions (personne 1 par scénario, personne 2 commune = colonne C).
 */
export function importTableauDeBord(
  wb: WorkBook,
  ctx: ImportContext,
  metas: ScenarioMeta[],
  finActiviteP2?: ProjectionMonth,
): void {
  const ws = findSheet(wb, 'tableau de bord');
  if (!ws) {
    warn(ctx, 'Onglet « Tableau de bord » introuvable : noms et pensions conservés.');
    return;
  }
  const rows = readRows(ws, 1, 8);
  const header = findRow(rows, { starts: 'poste' });
  const p1 = ctx.params.personnes[0]?.id ?? 'p1';
  for (const { scenario, numero, retraiteDebut, pensionAnnuelle } of metas) {
    const col = FIRST_SCENARIO_COL + numero - 1;
    const nom = header?.cells[col];
    if (typeof nom === 'string' && nom.trim()) scenario.nom = nom.trim();
    const net = pensionAt(rows, col, ['p1Avant', 'p1Apres'], ctx);
    if (net && retraiteDebut) {
      scenario.pensions = [
        {
          id: `${scenario.id}-pension-1`,
          personneId: p1,
          debut: retraiteDebut,
          ...net,
          ...(pensionAnnuelle ? { montantsAnnuels: pensionAnnuelle } : {}),
        },
      ];
    } else warn(ctx, `Pension de la personne 1 introuvable pour « ${scenario.nom} ».`);
  }
  const net = pensionAt(rows, FIRST_SCENARIO_COL, ['p2Avant', 'p2Apres'], ctx);
  if (net && finActiviteP2) {
    const pension: ProjectionPension = {
      id: 'commun-pension-2',
      personneId: ctx.params.personnes[1]?.id ?? 'p2',
      debut: finActiviteP2,
      ...net,
      ...(metas[0]?.pension2Annuelle ? { montantsAnnuels: metas[0].pension2Annuelle } : {}),
    };
    ctx.params.revenusCommuns.pensions = [pension];
  } else warn(ctx, 'Pension de la personne 2 introuvable : pensions communes conservées.');
}
