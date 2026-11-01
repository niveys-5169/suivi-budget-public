/**
 * Test de parité LOCAL global : projection reconstruite par les calculateurs (sans phases ni pensions
 * importées) comparée au classeur de simulation de l'utilisateur. Ignoré sans
 * `PROJECTION_XLSX=/chemin/vers/fichier.xlsx` (données personnelles, jamais versionnées).
 * Compare, pour chaque scénario « Calc S1…S5 » : le patrimoine total au 31/12 (colonne AE) et le
 * cash mensuel après PAS des deux personnes (colonnes G et L), puis la retraite du Tableau de bord
 * (lignes 14, 15, 17 et 18). N'affiche que des écarts.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { createDefaultProjectionParams } from '../projection/defaults';
import { buildProjectionReport } from '../projection/projectionReport';
import { importSimulationWorkbook } from '../projection/importSimulationXlsx';
import { resolveProjectionParams } from '../projection/resolveParams';
import { simulateAll } from '../projection/simulateProjection';
import { asMonth } from '../projection/xlsxSheetReader';
import { formatDecimal } from '../../lib/formatters';
import type { ProjectionInputs, ProjectionValeursObservees } from '../../types/banking.types';

const FILE = process.env.PROJECTION_XLSX;
const TOLERANCE_PATRIMOINE = Number(process.env.PROJECTION_CALCULEE_TOLERANCE ?? '0.001');
const TOLERANCE_CASH = Number(process.env.PROJECTION_CALCULEE_CASH ?? '1');
const PREMIERE_LIGNE = 6;

const SANS_OBSERVE: ProjectionValeursObservees = {
  periode: null,
  budgetReference: null,
  detailCategories: [],
  moyenneMensuelleParCategorie: {},
  credits: {},
  patrimoineHorsPer: null,
  epargneNetteMensuelle: null,
};

const TDB_COLONNES = ['C', 'D', 'E', 'F', 'G'];

const num = (ws: XLSX.WorkSheet, addr: string): number => Number(ws[addr]?.v ?? 0);

/** Écarts (patrimoine au 31/12, cash mensuel de P1 et P2) d'une simulation avec le classeur. */
function comparer(wb: XLSX.WorkBook, inputs: ProjectionInputs, ids: [string, string]) {
  const lignes: string[] = [];
  let pirePatrimoine = 0;
  let pireCash = 0;
  for (const r of simulateAll(inputs)) {
    const ws = wb.Sheets[`Calc S${r.scenarioId.slice(1)}`];
    if (!ws) continue;
    const parMois = new Map(r.mois.map((m) => [m.mois, m]));
    const pire = [0, 0];
    for (let row = PREMIERE_LIGNE; ws[`A${row}`]?.v instanceof Date; row += 1) {
      const mois = asMonth(ws[`A${row}`]!.v)!;
      const m = parMois.get(mois);
      if (!m) {
        lignes.push(`${r.scenarioId} ${mois} absent de la projection`);
        continue;
      }
      ids.forEach((id, i) => {
        const ecart = (m.revenusParPersonne[id] ?? 0) - num(ws, `${i === 0 ? 'G' : 'L'}${row}`);
        pire[i] = Math.max(pire[i]!, Math.abs(ecart));
        if (Math.abs(ecart) > TOLERANCE_CASH && lignes.length < 100)
          lignes.push(`${r.scenarioId} ${mois} cash P${i + 1} ${formatDecimal(ecart)}`);
      });
      if (mois.endsWith('-12') || ws[`A${row + 1}`]?.v === undefined) {
        const ecart = (m.patrimoineTotal - num(ws, `AE${row}`)) / num(ws, `AE${row}`);
        pirePatrimoine = Math.max(pirePatrimoine, Math.abs(ecart));
        lignes.push(
          `${r.scenarioId} ${mois.slice(0, 4)} patrimoine ${formatDecimal(ecart * 100, 3)} %`,
        );
      }
    }
    pireCash = Math.max(pireCash, ...pire);
    lignes.push(
      `${r.scenarioId} pire écart de cash : P1 ${formatDecimal(pire[0]!, 4)} €, P2 ${formatDecimal(pire[1]!, 4)} €`,
    );
  }
  return { lignes, pirePatrimoine, pireCash };
}

/** Retraite du rapport comparée au Tableau de bord : lignes 14 et 15 (avant impôt), 17 et 18 (après impôt). */
function comparerRetraite(wb: XLSX.WorkBook, inputs: ProjectionInputs, ids: [string, string]) {
  const tdb = wb.Sheets['Tableau de bord']!;
  const rapport = buildProjectionReport(inputs, simulateAll(inputs), inputs.scenarios[0]!.id, []);
  const lignes: string[] = [];
  let pire = 0;
  rapport.retraite.forEach((r, i) => {
    const col = TDB_COLONNES[i]!;
    const attendus: [string, number, number][] = [
      ['P1 avant impôt', r.parPersonne.find((p) => p.personneId === ids[0])!.netAvantImpot, 14],
      ['P2 avant impôt', r.parPersonne.find((p) => p.personneId === ids[1])!.netAvantImpot, 15],
      ['P1 après impôt', r.parPersonne.find((p) => p.personneId === ids[0])!.netApresImpot, 17],
      ['P2 après impôt', r.parPersonne.find((p) => p.personneId === ids[1])!.netApresImpot, 18],
    ];
    for (const [nom, obtenu, ligne] of attendus) {
      const ecart = obtenu - num(tdb, `${col}${ligne}`);
      pire = Math.max(pire, Math.abs(ecart));
      lignes.push(`${r.scenarioId} ${nom} ${formatDecimal(ecart)}`);
    }
  });
  return { lignes, pire };
}

describe.skipIf(!FILE)('parité projection calculée ↔ classeur (local)', () => {
  it('patrimoine au 31/12, cash mensuel et retraite de chaque scénario, sans lire les résultats du classeur', () => {
    const wb = XLSX.read(readFileSync(FILE!), { type: 'buffer', cellDates: true });
    const { params, avertissements } = importSimulationWorkbook(
      wb,
      createDefaultProjectionParams(new Date()),
    );
    // Les phases et pensions importées sont retirées : seuls les calculateurs produisent les revenus.
    params.revenusCommuns.phases = [];
    params.revenusCommuns.pensions = [];
    for (const s of params.scenarios) Object.assign(s, { phases: [], pensions: [] });
    params.calculateurs!.actif = true;
    const inputs = resolveProjectionParams(params, SANS_OBSERVE);
    const ids = params.personnes.map((p) => p.id) as [string, string];
    const patrimoineEtCash = comparer(wb, inputs, ids);
    const retraite = comparerRetraite(wb, inputs, ids);
    console.info(
      [
        `${avertissements.length} avertissement(s) d'import ; ${inputs.messagesCalculateurs?.length ?? 0} message(s) de calcul`,
        ...patrimoineEtCash.lignes,
        `pire écart de patrimoine : ${formatDecimal(patrimoineEtCash.pirePatrimoine * 100, 4)} %`,
        ...retraite.lignes,
      ].join('\n'),
    );
    expect(inputs.scenarios.every((s) => s.revenusMensuels)).toBe(true);
    expect(patrimoineEtCash.pireCash).toBeLessThanOrEqual(TOLERANCE_CASH);
    expect(patrimoineEtCash.pirePatrimoine).toBeLessThanOrEqual(TOLERANCE_PATRIMOINE);
    expect(retraite.pire).toBeLessThanOrEqual(TOLERANCE_CASH);
  });
});
