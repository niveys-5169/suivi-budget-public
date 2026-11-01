/**
 * Test de parité LOCAL du calculateur fiscal avec le classeur de simulation de l'utilisateur.
 * Ignoré sans `PROJECTION_XLSX=/chemin/vers/fichier.xlsx` : le classeur contient des données
 * personnelles et ne doit jamais être versionné. N'affiche que des écarts, jamais de valeurs.
 *
 * Entrées reconstituées comme le fait ⑫ : colonnes mensuelles AY (net imposable P1 hors BNC),
 * BA (BNC P1) et I (net imposable P2) de l'onglet mensuel — ⑤b pour ⑫ lui-même, « Calc S1…S5 »
 * pour les scénarios (chacun porte sa propre copie de ⑫, lignes 326 à 396, paramètres liés à ⑫).
 */
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { ABATTEMENT_10_POUR_CENT, BAREME_IR } from '../projection/fiscal/constants';
import { DECOTE_COUPLE, GRILLE_TAUX_DEFAUT } from '../projection/fiscal/constants';
import { PLAFOND_AVANTAGE_QF_DEMI_PART } from '../projection/fiscal/constants';
import { computeFiscalParAnnee, type FiscalAnneeInput } from '../projection/fiscal/computeFiscal';
import { asDay, findSheet } from '../projection/xlsxSheetReader';

const FILE = process.env.PROJECTION_XLSX;
const TOLERANCE_TAUX = 1e-9;
const TOLERANCE_EUROS = 1;

type Sheet = XLSX.WorkSheet;

const num = (ws: Sheet, addr: string): number => Number(ws[addr]?.v ?? 0);

/** Somme et nombre de mois par année des colonnes mensuelles (lignes 6 et suivantes, colonne A = date). */
function annualiser(ws: Sheet): Map<number, FiscalAnneeInput> {
  const annees = new Map<number, FiscalAnneeInput>();
  for (let row = 6; ws[`A${row}`]?.v instanceof Date; row += 1) {
    const annee = (ws[`A${row}`]!.v as Date).getFullYear();
    const cur = annees.get(annee) ?? {
      annee,
      moisProjetes: 0,
      imposableP1: 0,
      bncP1: 0,
      imposableP2: 0,
    };
    cur.moisProjetes += 1;
    cur.imposableP1 += num(ws, `AY${row}`);
    cur.bncP1 += num(ws, `BA${row}`);
    cur.imposableP2 += num(ws, `I${row}`);
    annees.set(annee, cur);
  }
  return annees;
}

/** Lignes du tableau « TAUX PAR ANNÉE » (titre en colonne A, en-têtes juste dessous, puis une ligne par année). */
function lignesTaux(ws: Sheet): number[] {
  let titre = 0;
  for (let row = 1; row < 600 && !titre; row += 1) {
    if (String(ws[`A${row}`]?.v ?? '').startsWith('TAUX PAR ANN')) titre = row;
  }
  const rows: number[] = [];
  for (let row = titre + 2; typeof ws[`A${row}`]?.v === 'number'; row += 1) rows.push(row);
  return rows;
}

/** Lit le classeur et les paramètres de ⑫ (appelé dans les tests : le corps de `describe` s'exécute même ignoré). */
function load() {
  const wb = XLSX.read(readFileSync(FILE!), { type: 'buffer', cellDates: true });
  const ws12 = findSheet(wb, 'calcul taux pas')!;
  const wsFoyer = findSheet(wb, 'revenus foyer & pas')!;
  const wsBudget = findSheet(wb, 'budget foyer')!;
  const enfants = ['B151', 'B152']
    .map((addr) => asDay(wsFoyer[addr]?.v))
    .filter((d): d is string => d !== undefined)
    .map((dateNaissance) => ({ dateNaissance }));
  const params = {
    enfants,
    indexation: num(ws12, 'B6'),
    ageLimiteRattachement: num(wsFoyer, 'B153'),
    tauxIndividualises: num(ws12, 'B14') === 1,
    premiereAnneeRecalculee: num(ws12, 'B13'),
    tauxReelsActuels: { p1: num(wsFoyer, 'B34'), p2: num(wsFoyer, 'C34') },
    anneeReferenceBareme: num(ws12, 'B5'),
    anneeGrille: num(ws12, 'B16'),
  };
  return { wb, ws12, wsBudget, params };
}

describe.skipIf(!FILE)('parité fiscale ↔ classeur (local)', () => {
  it('constantes légales identiques aux paramètres de ⑫', () => {
    const { ws12 } = load();
    const ecarts: string[] = [];
    const cmp = (nom: string, code: number, addr: string) => {
      if (Math.abs(code - num(ws12, addr)) > 1e-12) ecarts.push(`${nom} (${addr})`);
    };
    cmp('année barème', BAREME_IR.anneeRevenus, 'B5');
    cmp('plafond QF', PLAFOND_AVANTAGE_QF_DEMI_PART, 'B7');
    cmp('abattement taux', ABATTEMENT_10_POUR_CENT.taux, 'B8');
    cmp('abattement min', ABATTEMENT_10_POUR_CENT.minimum, 'B9');
    cmp('abattement max', ABATTEMENT_10_POUR_CENT.maximum, 'B10');
    cmp('décote forfait', DECOTE_COUPLE.forfait, 'B11');
    cmp('décote coefficient', DECOTE_COUPLE.coefficient, 'B12');
    cmp('année grille', GRILLE_TAUX_DEFAUT.annee, 'B16');
    BAREME_IR.tranches.forEach((t, i) => {
      const col = 'BCDEF'[i]!;
      cmp(`seuil T${i + 1}`, t.seuil, `${col}19`);
      cmp(`taux T${i + 1}`, t.taux, `${col}20`);
    });
    GRILLE_TAUX_DEFAUT.bornes.forEach((b, i) => {
      cmp(`grille seuil ${i}`, b.seuilMensuel, `A${24 + i}`);
      cmp(`grille taux ${i}`, b.taux, `B${24 + i}`);
    });
    console.info(`constantes : ${ecarts.length} écart(s) ${ecarts.join(', ')}`);
    expect(ecarts).toEqual([]);
  });

  const cas = ['⑫ (scénario affiché)', 'Calc S1', 'Calc S2', 'Calc S3', 'Calc S4', 'Calc S5'];

  it.each(cas)('%s : taux P1/P2 et IR net, année par année', (nom) => {
    const { wb, ws12, wsBudget, params } = load();
    const wsM = nom.startsWith('Calc') ? wb.Sheets[nom] : wsBudget;
    const wsT = nom.startsWith('Calc') ? wb.Sheets[nom] : ws12;
    if (!wsM || !wsT) return;
    const entrees = annualiser(wsM);
    const rows = lignesTaux(wsT);
    const annees = rows.map(
      (row) =>
        entrees.get(num(wsT, `A${row}`)) ?? {
          annee: num(wsT, `A${row}`),
          moisProjetes: 0,
          imposableP1: 0,
          bncP1: 0,
          imposableP2: 0,
        },
    );
    const calcul = computeFiscalParAnnee({ ...params, annees });
    const ecarts: string[] = [];
    rows.forEach((row, i) => {
      const r = calcul[i]!;
      const verif: [string, number, number, number][] = [
        ['taux P1', r.tauxP1, num(wsT, `Y${row}`), TOLERANCE_TAUX],
        ['taux P2', r.tauxP2, num(wsT, `Z${row}`), TOLERANCE_TAUX],
        ['taux foyer', r.tauxFoyer, num(wsT, `S${row}`), TOLERANCE_TAUX],
        ['parts', r.parts, num(wsT, `K${row}`), TOLERANCE_TAUX],
        ['revenu imposable', r.revenuNetImposable, num(wsT, `J${row}`), TOLERANCE_EUROS],
        ['IR net', r.irNet, num(wsT, `R${row}`), TOLERANCE_EUROS],
      ];
      for (const [nom, obtenu, attendu, tol] of verif) {
        if (Math.abs(obtenu - attendu) > tol)
          ecarts.push(`${r.annee} ${nom} écart ${(obtenu - attendu).toPrecision(3)}`);
      }
    });
    console.info(
      `${rows.length} années comparées, ${ecarts.length} écart(s)\n${ecarts.join('\n')}`,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(ecarts).toEqual([]);
  });
});
