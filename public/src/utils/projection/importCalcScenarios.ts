import type { WorkBook, WorkSheet } from '@e965/xlsx';
import type { ProjectionMonth, ProjectionScenario } from '../../types/banking.types';
import { PROJECTION_MAX_SCENARIOS } from './defaults';
import {
  differencePhase,
  groupSeries,
  seriesToPhase,
  yearlyAmounts,
  type PhaseSeries,
} from './importPhases';
import { recognized, warn, type ImportContext } from './importContext';
import { asDate, asMonth, asNumber, normalizeLabel, readCell, shiftMonth } from './xlsxSheetReader';

/** Scénario importé, avec son numéro d'onglet et le 1er mois de retraite de la personne 1. */
export interface ScenarioMeta {
  scenario: ProjectionScenario;
  numero: number;
  retraiteDebut?: ProjectionMonth;
  /** Cash moyen par année de la pension de la personne 1 (mois de retraite de l'onglet). */
  pensionAnnuelle?: Record<string, number>;
  /** Idem pour la pension de la personne 2 (premier onglet uniquement). */
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

/** Phase « Activité » de la personne 2 : 1er mois → mois précédant sa fin d'activité. */
function commonPhase(lines: CalcLine[], ctx: ImportContext, finActivite?: ProjectionMonth) {
  const kept = lines.filter((l) => !finActivite || l.mois < finActivite);
  if (kept.length === 0) return undefined;
  const series: PhaseSeries = {
    libelle: 'Activité',
    points: kept.map((l) => ({ mois: l.mois, value: l.cash2 })),
  };
  const personneId = ctx.params.personnes[1]?.id ?? 'p2';
  const { fin: _fin, ...phase } = seriesToPhase('commun-activite', personneId, series);
  return finActivite ? { ...phase, fin: shiftMonth(finActivite, -1) } : phase;
}

/**
 * Onglets « Calc S1 » … « Calc S5 » : un scénario par onglet (phases de la personne 1),
 * phase commune de la personne 2 d'après le premier onglet.
 */
export function importCalcScenarios(
  wb: WorkBook,
  ctx: ImportContext,
  finActiviteP2?: ProjectionMonth,
): ScenarioMeta[] {
  const metas: ScenarioMeta[] = [];
  const personneId = ctx.params.personnes[0]?.id ?? 'p1';
  let refCash2: { mois: ProjectionMonth; value: number }[] = [];
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
    const scenario: ProjectionScenario = { id, nom: `Scénario ${numero}`, phases, pensions: [] };
    const retraiteDebut = lines.find((l) => normalizeLabel(l.phase) === 'retraite')?.mois;
    const pensionAnnuelle = retraiteDebut
      ? yearlyAmounts(
          lines
            .filter((l) => l.mois >= retraiteDebut)
            .map((l) => ({ mois: l.mois, value: l.cash1 })),
          false,
        )
      : undefined;
    const meta: ScenarioMeta = { scenario, numero, retraiteDebut, pensionAnnuelle };
    metas.push(meta);
    recognized(ctx, name);
    if (metas.length > 1) {
      const p2 = ctx.params.personnes[1]?.id ?? 'p2';
      const ecart = differencePhase(
        `${id}-ecart-p2`,
        p2,
        'Écart PAS personne 2',
        lines.map((l) => ({ mois: l.mois, value: l.cash2 })),
        refCash2,
      );
      if (ecart) phases.push(ecart);
    }
    if (metas.length === 1) {
      refCash2 = lines.map((l) => ({ mois: l.mois, value: l.cash2 }));
      const phase = commonPhase(lines, ctx, finActiviteP2);
      if (phase) ctx.params.revenusCommuns.phases = [phase];
      if (finActiviteP2) {
        const pointsP2 = lines.filter((l) => l.mois >= finActiviteP2);
        if (pointsP2.length > 0)
          meta.pension2Annuelle = yearlyAmounts(
            pointsP2.map((l) => ({ mois: l.mois, value: l.cash2 })),
            false,
          );
      }
    }
  }
  if (metas.length === 0) {
    warn(ctx, 'Onglets « Calc S1 » … « Calc S5 » introuvables : scénarios conservés.');
    return metas;
  }
  ctx.params.scenarios = metas.map((m) => m.scenario);
  ctx.params.scenarioAfficheId = metas[0]!.scenario.id;
  return metas;
}
