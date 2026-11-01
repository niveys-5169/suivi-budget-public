/**
 * Test de parité LOCAL du calculateur d'activité de la personne 1 avec le classeur de simulation.
 * Ignoré sans `PROJECTION_XLSX=/chemin/vers/fichier.xlsx` : le classeur contient des données
 * personnelles et ne doit jamais être versionné. N'affiche que des écarts, jamais de valeurs.
 *
 * Entrées lues dans ①, ①b, ②, ②b, ⑥ et Hypothèses ; sorties comparées mois par mois aux onglets
 * « Calc S1…S5 » : C, D, AY, BA, BC, R, AF et B, plus H et I (personne 2). Les pensions de retraite
 * (colonnes BF à BI, lot « retraite ») sont retirées des colonnes du classeur avant comparaison.
 */
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { computeActivitePersonne1 } from '../projection/activite/computeActivite';
import { asDay, asMonth } from '../projection/xlsxSheetReader';
import { formatDecimal } from '../../lib/formatters';
import type {
  ProjectionActiviteMois,
  ProjectionActiviteParams,
  ProjectionChargeLiberale,
} from '../../types/banking.types';

const FILE = process.env.PROJECTION_XLSX;
const TOLERANCE = Number(process.env.PROJECTION_ACTIVITE_TOLERANCE ?? '0.01');
const PREMIERE_LIGNE = 6;
const NATURES: Record<string, ProjectionChargeLiberale['nature']> = {
  Fixe: 'fixe',
  Variable: 'variable',
  CFE: 'cfe',
};

type Sheet = XLSX.WorkSheet;
const sheet = (wb: XLSX.WorkBook, name: string): Sheet => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Onglet introuvable : ${name}`);
  return ws;
};
const num = (ws: Sheet, addr: string): number => Number(ws[addr]?.v ?? 0);
const jour = (ws: Sheet, addr: string): string => asDay(ws[addr]?.v) ?? '';

/** Paramètres du calculateur lus dans les onglets de saisie (l'id de scénario est « S1 » à « S5 »). */
function lireParams(wb: XLSX.WorkBook): ProjectionActiviteParams {
  const [o1, o1b, o2, o2b, o6, hyp] = [
    sheet(
      wb,
      wb.SheetNames.find((n) => n.startsWith('① R'))!,
    ),
    sheet(
      wb,
      wb.SheetNames.find((n) => n.startsWith('①b'))!,
    ),
    sheet(
      wb,
      wb.SheetNames.find((n) => n.startsWith('② M'))!,
    ),
    sheet(
      wb,
      wb.SheetNames.find((n) => n.startsWith('②b'))!,
    ),
    sheet(
      wb,
      wb.SheetNames.find((n) => n.startsWith('⑥'))!,
    ),
    sheet(wb, 'Hypothèses'),
  ];
  const charges: ProjectionChargeLiberale[] = [];
  for (let row = 12; row <= 28; row += 1) {
    charges.push({
      libelle: String(o2[`A${row}`]?.v ?? ''),
      montantReference: num(o2, `F${row}`),
      nature: NATURES[String(o2[`G${row}`]?.v)] ?? 'fixe',
    });
  }
  const scenarios: Record<string, number> = {};
  [133, 134, 135, 136, 137].forEach((row, i) => {
    scenarios[`S${i + 1}`] = num(o1b, `C${row}`);
  });
  return {
    personne1: { dateNaissance: jour(o1b, 'B117'), ageDepartRetraite: num(o1b, 'B118') },
    paie: {
      netAvantPas: num(o1b, 'B5'),
      netImposable: num(o1b, 'B6'),
      moisPayesParAn: num(o1b, 'B10'),
      ratioImposableRemplacement: num(o1b, 'B15'),
    },
    calendrier: {
      dateNotification: jour(o1, 'B86'),
      delaiReflexionJours: num(o1, 'B87'),
      dureePreavisMois: num(o1, 'B89'),
      dureeCongeMois: num(o1, 'B92'),
      debutAssociation: jour(o1, 'B98'),
      dateBasculeLiberal: jour(o1b, 'B126'),
    },
    reclassement: {
      tauxAllocation: num(o1, 'B49'),
      brutMensuelReference: num(o1, 'B50'),
      assietteAgircArrcoMensuelle: num(o1, 'B159') * num(o1, 'B156'),
    },
    are: { sjr: num(o6, 'B26'), assietteSupralegale: num(o1, 'B30'), iccpBrute: num(o1, 'B36') },
    ccn66: {
      coefficient: num(o2b, 'B5'),
      valeurPoint: num(o2b, 'B4'),
      cti: num(o2b, 'B9'),
      tauxCotisationsSalariales: num(o2b, 'B11'),
      progressionAnnuelle: num(o2b, 'B13'),
    },
    liberal: {
      tarifMesure: num(hyp, 'C19'),
      monteeEnCharge: [num(o1b, 'B127'), num(o1b, 'B128'), num(o1b, 'B129')],
      mesuresReference: num(o2, 'B7'),
      charges,
      coefficientCfe: [num(o2, 'B6'), num(o2, 'C6'), num(o2, 'D6')],
      perAnnuel: num(o2, 'B58'),
      tauxMaladieMaternite: [num(o2, 'B39'), num(o2, 'C39'), num(o2, 'D39')],
    },
    scenarios,
    irImpute: { revenuImposableAutrePersonne: num(o1, 'B7'), parts: num(o1, 'B3') },
    personne2: {
      dateNaissance: jour(o1b, 'B121'),
      ageFinActivite: num(o1b, 'B122'),
      netAvantPasMensuel: num(o1b, 'B25'),
      netImposableMensuel: num(o1b, 'B26'),
      revalorisationAnnuelle: num(o1, 'B104'),
      anneeReference: num(o1b, 'A34'),
    },
  };
}

/** Libellé du classeur sans le nom d'employeur entre parenthèses de la phase « Situation actuelle ». */
const sansEmployeur = (label: string): string =>
  label.startsWith('Situation actuelle') ? 'Situation actuelle' : label;

describe.skipIf(!FILE)('parité activité personne 1 ↔ classeur (local)', () => {
  it.each(['S1', 'S2', 'S3', 'S4', 'S5'])("Calc %s : revenus d'activité mois par mois", (id) => {
    const wb = XLSX.read(readFileSync(FILE!), { type: 'buffer', cellDates: true });
    const params = lireParams(wb);
    const calc = sheet(wb, `Calc ${id}`);
    const lignes: number[] = [];
    for (let row = PREMIERE_LIGNE; calc[`A${row}`]?.v instanceof Date; row += 1) lignes.push(row);
    const debut = asMonth(calc[`A${lignes[0]}`]?.v)!;
    const fin = asMonth(calc[`A${lignes[lignes.length - 1]}`]?.v)!;
    const tauxPasParAnnee: Record<number, number> = {};
    for (const row of lignes)
      tauxPasParAnnee[Number(asMonth(calc[`A${row}`]?.v)!.slice(0, 4))] = num(calc, `AV${row}`);
    const calcul = computeActivitePersonne1(
      { horizon: { debut, fin }, params, tauxPasParAnnee },
      id,
    );
    expect(calcul).toHaveLength(lignes.length);

    const pire: Record<string, number> = {};
    const ecarts: string[] = [];
    const compare = (nom: string, m: ProjectionActiviteMois, obtenu: number, attendu: number) => {
      const ecart = obtenu - attendu;
      pire[nom] = Math.max(pire[nom] ?? 0, Math.abs(ecart));
      if (Math.abs(ecart) > TOLERANCE) ecarts.push(`${m.mois} ${nom} ${formatDecimal(ecart)}`);
    };
    lignes.forEach((row, i) => {
      const m = calcul[i]!;
      const pensionNet = num(calc, `BF${row}`);
      const pensionImposable = num(calc, `BG${row}`);
      compare('C', m, m.netAvantPas, num(calc, `C${row}`) - pensionNet);
      compare('D', m, m.netImposable, num(calc, `D${row}`) - pensionImposable);
      compare('AY', m, m.netImposableHorsLiberal, num(calc, `AY${row}`) - pensionImposable);
      compare('AZ', m, m.liberalNetAvantImpot, num(calc, `AZ${row}`));
      compare('BA', m, m.bncImposable, num(calc, `BA${row}`));
      compare('BB', m, m.liberalIrImpute, num(calc, `BB${row}`));
      compare('BC', m, m.per, -num(calc, `BC${row}`));
      compare('R', m, m.revenuManquant, num(calc, `R${row}`));
      compare('AQ', m, m.anneeAssociation, num(calc, `AQ${row}`));
      compare('AR', m, m.netSalaireAssociation, num(calc, `AR${row}`));
      compare('AF', m, m.codePhase, num(calc, `AF${row}`));
      compare('H', m, m.netAvantPasPersonne2, num(calc, `H${row}`) - num(calc, `BH${row}`));
      compare('I', m, m.netImposablePersonne2, num(calc, `I${row}`) - num(calc, `BI${row}`));
      const attendu = sansEmployeur(String(calc[`B${row}`]?.v ?? ''));
      if (m.phase !== attendu) ecarts.push(`${m.mois} libellé de phase différent`);
    });
    const resume = Object.entries(pire)
      .map(([nom, valeur]) => `${nom} ${valeur.toExponential(1)}`)
      .join(' | ');
    console.info(
      `${id} : ${lignes.length} mois, pire écart par colonne : ${resume}\n${ecarts.slice(0, 20).join('\n')}`,
    );
    expect(ecarts).toEqual([]);
  });
});
