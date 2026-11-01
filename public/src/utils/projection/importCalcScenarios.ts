import type { WorkBook, WorkSheet } from '@e965/xlsx';
import type { ProjectionMonth, ProjectionScenario } from '../../types/banking.types';
import { PROJECTION_MAX_SCENARIOS } from './defaults';
import { pensionAmounts } from './importCalcPensions';
import { groupSeries, seriesToPhase, type PhaseSeries } from './importPhases';
import { recognized, warn, type ImportContext } from './importContext';
import { asDate, asMonth, asNumber, normalizeLabel, readCell, shiftMonth } from './xlsxSheetReader';

/** Scénario importé, avec son numéro d'onglet et le 1er mois de retraite de la personne 1. */
export interface ScenarioMeta {
  scenario: ProjectionScenario;
  numero: number;
  retraiteDebut?: ProjectionMonth;
  /** Cash moyen par année de la pension de la personne 1 (mois de retraite de l'onglet). */
  pensionAnnuelle?: Record<string, number>;
  /** Idem pour la pension de la personne 2 (colonne cash personne 2 de l'onglet). */
  pension2Annuelle?: Record<string, number>;
}

interface CalcLine {
  mois: ProjectionMonth;
  phase: string;
  cash1: number;
  cash2: number;
}

const DEFAULT_COLUMNS = { phase: 1, cash1: 6, cash2: 11, firstRow: 6 };

/** Repère les colonnes par leurs en-têtes (ligne « Mois »), repli sur les colonnes B, G, L. */
function locateColumns(ws: WorkSheet) {
  for (let row = 1; row <= 10; row += 1) {
    if (normalizeLabel(readCell(ws, row, 0)) !== 'mois') continue;
    const heads = Array.from({ length: 20 }, (_, col) => normalizeLabel(readCell(ws, row, col)));
    const cash = heads.flatMap((h, col) =>
      h.includes('cash') && h.includes('apres pas') ? [col] : [],
    );
    const phase = heads.findIndex((h) => h.startsWith('phase'));
    return {
      phase: phase >= 0 ? phase : DEFAULT_COLUMNS.phase,
      cash1: cash[0] ?? DEFAULT_COLUMNS.cash1,
      cash2: cash[1] ?? DEFAULT_COLUMNS.cash2,
      firstRow: row + 1,
    };
  }
  return DEFAULT_COLUMNS;
}

/** Lignes mensuelles : arrêt à la première ligne dont la colonne A n'est pas une date. */
function readCalcLines(ws: WorkSheet): CalcLine[] {
  const cols = locateColumns(ws);
  const lines: CalcLine[] = [];
  for (let row = cols.firstRow; asDate(readCell(ws, row, 0)); row += 1) {
    const phase = readCell(ws, row, cols.phase);
    lines.push({
      mois: asMonth(readCell(ws, row, 0))!,
      phase: typeof phase === 'string' ? phase.trim() : '',
      cash1: asNumber(readCell(ws, row, cols.cash1)) ?? 0,
      cash2: asNumber(readCell(ws, row, cols.cash2)) ?? 0,
    });
  }
  return lines;
}

function calcSheets(wb: WorkBook): { name: string; numero: number }[] {
  return wb.SheetNames.flatMap((name) => {
    const match = /^calc s(\d+)$/.exec(normalizeLabel(name));
    return match ? [{ name, numero: Number(match[1]) }] : [];
  }).sort((a, b) => a.numero - b.numero);
}

/** Phase « Activité » de la personne 2 d'un onglet : 1er mois → mois précédant sa fin d'activité. */
function p2Phase(id: string, lines: CalcLine[], ctx: ImportContext, finActivite?: ProjectionMonth) {
  const kept = lines.filter((l) => !finActivite || l.mois < finActivite);
  if (kept.length === 0) return undefined;
  const series: PhaseSeries = {
    libelle: 'Activité',
    points: kept.map((l) => ({ mois: l.mois, value: l.cash2 })),
  };
  const personneId = ctx.params.personnes[1]?.id ?? 'p2';
  const { fin: _fin, ...phase } = seriesToPhase(`${id}-p2-activite`, personneId, series);
  return finActivite ? { ...phase, fin: shiftMonth(finActivite, -1) } : phase;
}

/**
 * Onglets « Calc S1 » … « Calc S5 » : un scénario par onglet, avec les phases de la personne 1
 * et la phase « Activité » de la personne 2 lues dans cet onglet.
 */
export function importCalcScenarios(
  wb: WorkBook,
  ctx: ImportContext,
  finActiviteP2?: ProjectionMonth,
): ScenarioMeta[] {
  const metas: ScenarioMeta[] = [];
  const personneId = ctx.params.personnes[0]?.id ?? 'p1';
  for (const { name, numero } of calcSheets(wb).slice(0, PROJECTION_MAX_SCENARIOS)) {
    const lines = readCalcLines(wb.Sheets[name]!);
    if (lines.length === 0) {
      warn(ctx, `Onglet « ${name} » : aucune ligne mensuelle lisible, scénario ignoré.`);
      continue;
    }
    const id = `s${numero}`;
    const series = groupSeries(
      lines.map((l) => ({ mois: l.mois, libelle: l.phase, value: l.cash1 })),
    );
    const phases = series
      .filter((s) => normalizeLabel(s.libelle) !== 'retraite')
      .map((s, i) => seriesToPhase(`${id}-phase-${i + 1}`, personneId, s));
    const activiteP2 = p2Phase(id, lines, ctx, finActiviteP2);
    if (activiteP2) phases.push(activiteP2);
    const scenario: ProjectionScenario = { id, nom: `Scénario ${numero}`, phases, pensions: [] };
    const retraiteDebut = lines.find((l) => normalizeLabel(l.phase) === 'retraite')?.mois;
    const meta: ScenarioMeta = {
      scenario,
      numero,
      retraiteDebut,
      pensionAnnuelle: pensionAmounts(lines, retraiteDebut, 1),
      pension2Annuelle: pensionAmounts(lines, finActiviteP2, 2),
    };
    metas.push(meta);
    recognized(ctx, name);
  }
  if (metas.length === 0) {
    warn(ctx, 'Onglets « Calc S1 » … « Calc S5 » introuvables : scénarios conservés.');
    return metas;
  }
  const p2 = ctx.params.personnes[1]?.id ?? 'p2';
  const { revenusCommuns } = ctx.params;
  revenusCommuns.phases = revenusCommuns.phases.filter((p) => p.personneId !== p2);
  ctx.params.scenarios = metas.map((m) => m.scenario);
  ctx.params.scenarioAfficheId = metas[0]!.scenario.id;
  return metas;
}
