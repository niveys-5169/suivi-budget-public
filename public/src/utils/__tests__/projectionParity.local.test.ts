/**
 * Test de parité LOCAL avec le classeur de simulation de l'utilisateur.
 * Ignoré sans `PROJECTION_XLSX=/chemin/vers/fichier.xlsx` : le classeur contient des données
 * personnelles et ne doit jamais être versionné. Affiche les écarts sans les valeurs.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { createDefaultProjectionParams } from '../projection/defaults';
import { importSimulationWorkbook } from '../projection/importSimulationXlsx';
import { resolveProjectionParams } from '../projection/resolveParams';
import { simulateAll } from '../projection/simulateProjection';
import type { ProjectionValeursObservees } from '../../types/banking.types';

const FILE = process.env.PROJECTION_XLSX;
const TOLERANCE = Number(process.env.PROJECTION_TOLERANCE ?? '0.02');

const NO_OBSERVED: ProjectionValeursObservees = {
  periode: null,
  budgetReference: null,
  detailCategories: [],
  moyenneMensuelleParCategorie: {},
  credits: {},
  patrimoineHorsPer: null,
  epargneNetteMensuelle: null,
};

/** Patrimoine total (colonne AE) au dernier mois de chaque année d'un onglet Calc. */
function excelYearEnd(ws: XLSX.WorkSheet): Map<number, number> {
  const out = new Map<number, number>();
  for (let row = 6; ; row += 1) {
    const mois = ws[`A${row}`]?.v;
    if (!(mois instanceof Date)) break;
    out.set(mois.getFullYear(), Number(ws[`AE${row}`]?.v ?? 0));
  }
  return out;
}

describe.skipIf(!FILE)('parité moteur ↔ classeur (local)', () => {
  it('patrimoine au 31/12 de chaque scénario dans la tolérance', () => {
    const wb = XLSX.read(readFileSync(FILE!), { type: 'buffer', cellDates: true });
    const { params } = importSimulationWorkbook(wb, createDefaultProjectionParams(new Date()));
    const resultats = simulateAll(resolveProjectionParams(params, NO_OBSERVED));
    const ecarts: string[] = [];
    let pire = 0;
    for (const r of resultats) {
      const ws = wb.Sheets[`Calc S${r.scenarioId.slice(1)}`];
      if (!ws) continue;
      for (const [annee, attendu] of excelYearEnd(ws)) {
        const obtenu = r.mois.filter((m) => m.mois.startsWith(`${annee}-`)).pop()?.patrimoineTotal;
        if (obtenu === undefined || attendu === 0) continue;
        const ecart = (obtenu - attendu) / attendu;
        pire = Math.max(pire, Math.abs(ecart));
        ecarts.push(`${r.scenarioId} ${annee} ${(ecart * 100).toFixed(2)} %`);
      }
    }
    console.info(ecarts.join('\n'));
    expect(pire).toBeLessThanOrEqual(TOLERANCE);
  });
});
