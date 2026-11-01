/**
 * Test de parité LOCAL du calculateur de retraite avec le classeur de simulation de l'utilisateur
 * (③ Retraite, ③b SAM par scénario, ③c (retraite de la personne 2), Hypothèses bloc 5, Tableau de bord lignes 9-21).
 * Ignoré sans `PROJECTION_XLSX=/chemin/vers/fichier.xlsx` : le classeur contient des données
 * personnelles et ne doit jamais être versionné. N'affiche que les écarts, jamais les valeurs.
 * Tolérance : 1 € par mois (`PROJECTION_RETRAITE_TOLERANCE`).
 */
import { readFileSync } from 'node:fs';
import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { computeRetraitePersonne } from '../projection/retraite/computeRetraite';
import { NOMBRE_MEILLEURES_ANNEES } from '../projection/retraite/constants';
import { formatDecimal } from '../../lib/formatters';
import type {
  ProjectionRetraiteCarriereAnnee,
  ProjectionRetraitePersonneParams,
} from '../../types/banking.types';

const FILE = process.env.PROJECTION_XLSX;
const TOLERANCE = Number(process.env.PROJECTION_RETRAITE_TOLERANCE ?? '1');
const ANNEE_RELEVE = 2025;
const SCENARIO_COLS = ['B', 'C', 'D', 'E', 'F']; // ③b lignes 75-98
const TDB_COLS = ['C', 'D', 'E', 'F', 'G']; // Tableau de bord lignes 9-21

const sheet = (wb: XLSX.WorkBook, name: string): XLSX.WorkSheet => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Onglet introuvable : ${name}`);
  return ws;
};

const num = (ws: XLSX.WorkSheet, addr: string): number => Number(ws[addr]?.v ?? 0);

/** Paramètres communs lus dans Hypothèses (bloc 5) et ③b. */
function baseParams(wb: XLSX.WorkBook, personneId: string): ProjectionRetraitePersonneParams {
  const hyp = sheet(wb, 'Hypothèses');
  return {
    personneId,
    trimestresValides: num(hyp, 'C58'),
    anneeReleve: ANNEE_RELEVE,
    trimestresRequis: num(hyp, 'C59'),
    pointsAgircArrco: num(hyp, 'C60'),
    valeurPointAgircArrco: num(hyp, 'C61'),
    prixPointAgircArrco: num(hyp, 'C72'),
    pointsCipavParAn: num(hyp, 'C62'),
    bncReferenceCipav: num(sheet(wb, '③b SAM par scénario'), 'B20'),
    valeurPointCipav: num(hyp, 'C63'),
    rentePerMensuelle: num(hyp, 'C57'),
    tauxPrelevementsSociaux: num(hyp, 'C64'),
    revalorisationSalaires: num(hyp, 'C65'),
    croissancePass: num(hyp, 'C66'),
    nombreMeilleuresAnnees: NOMBRE_MEILLEURES_ANNEES,
  };
}

/** Collecte les écarts (sans valeurs) ; `pire` = plus grand écart absolu. */
function comparateur() {
  const lignes: string[] = [];
  let pire = 0;
  return {
    compare(label: string, obtenu: number, attendu: number) {
      const ecart = obtenu - attendu;
      pire = Math.max(pire, Math.abs(ecart));
      lignes.push(`${label} ${ecart >= 0 ? '+' : ''}${formatDecimal(ecart)}`);
    },
    affiche: () => console.info(lignes.join('\n')),
    pire: () => pire,
  };
}

const chargerClasseur = () => XLSX.read(readFileSync(FILE!), { type: 'buffer', cellDates: true });

describe.skipIf(!FILE)('parité retraite ↔ classeur (local)', () => {
  it('personne 1 : CNAV, Agirc-Arrco, Cipav, PER, brut, net et trimestres de chaque scénario', () => {
    const wb = chargerClasseur();
    const { compare, affiche, pire } = comparateur();
    const sam = sheet(wb, '③b SAM par scénario');
    const retraite = sheet(wb, '③ Retraite');
    const tdb = sheet(wb, 'Tableau de bord');
    const params = baseParams(wb, 'p1');
    SCENARIO_COLS.forEach((col, i) => {
      const liberal = num(sam, `${col}77`) !== 0; // mesures cibles > 0 : parcours B (colonne J)
      const carriere: ProjectionRetraiteCarriereAnnee[] = [];
      for (let row = 26; row <= 71; row += 1) {
        const annee = num(sam, `A${row}`);
        // Points Agirc-Arrco des années postérieures au relevé : congé de reclassement (③ B14) en 2026,
        // association (③ B15 × mois ③b ligne 88) en 2027 — calculés en amont, comme dans le classeur.
        const points =
          annee === 2026
            ? num(retraite, 'B14')
            : annee === 2027
              ? num(retraite, 'B15') * num(sam, `${col}88`)
              : 0;
        carriere.push({
          annee,
          salaireRG: num(sam, `${liberal ? 'J' : 'I'}${row}`),
          pointsAgircArrco: points,
        });
      }
      // Les points Cipav sont linéaires en BNC : une année-équivalent cumule années libérales × BNC moyen.
      carriere.push({ annee: 2100, bnc: num(sam, `${col}91`) * num(sam, `${col}93`) });
      const r = computeRetraitePersonne({
        params,
        carriere,
        ageLiquidation: num(retraite, 'B8'),
        trimestresAutresRegimes: num(sam, `${col}81`),
      });
      const t = TDB_COLS[i];
      const s = `S${i + 1}`;
      compare(`${s} CNAV`, r.detailBrut.cnav, num(tdb, `${t}9`));
      compare(`${s} Agirc-Arrco`, r.detailBrut.agircArrco, num(tdb, `${t}10`));
      compare(`${s} Cipav`, r.detailBrut.cipav, num(tdb, `${t}11`));
      compare(`${s} PER`, r.detailBrut.per, num(tdb, `${t}12`));
      compare(`${s} total brut`, r.totalBrut, num(tdb, `${t}13`));
      compare(`${s} net`, r.netAvantImpot, num(tdb, `${t}14`));
      compare(`${s} trimestres`, r.trimestres.total, num(tdb, `${t}21`));
    });
    affiche();
    expect(pire()).toBeLessThanOrEqual(TOLERANCE);
  });

  it('personne 2 : pension nette de ③c', () => {
    const wb = chargerClasseur();
    const { compare, affiche, pire } = comparateur();
    const nomOnglet = wb.SheetNames.find((n) => n.startsWith('③c'));
    if (!nomOnglet) throw new Error('Onglet ③c introuvable');
    const p2 = sheet(wb, nomOnglet);
    const hyp = sheet(wb, 'Hypothèses');
    const base = baseParams(wb, 'p2');
    const params: ProjectionRetraitePersonneParams = {
      ...base,
      trimestresValides: num(hyp, 'C69'),
      trimestresRequis: num(hyp, 'C71'),
      // ③c B57 = B16 + H50 : H25 (année 2025) s'ajoute aux points déjà acquis au 31/12/2025.
      pointsAgircArrco: num(hyp, 'C70') + num(p2, 'H25'),
      pointsCipavParAn: 0,
      rentePerMensuelle: 0,
    };
    const carriere: ProjectionRetraiteCarriereAnnee[] = [];
    for (let row = 25; row <= 49; row += 1) {
      carriere.push({ annee: num(p2, `A${row}`), salaireRG: num(p2, `C${row}`) });
    }
    const r = computeRetraitePersonne({ params, carriere });
    compare('P2 CNAV', r.detailBrut.cnav, num(p2, 'B56'));
    compare('P2 Agirc-Arrco', r.detailBrut.agircArrco, num(p2, 'B59'));
    compare('P2 total brut', r.totalBrut, num(p2, 'B60'));
    compare('P2 net', r.netAvantImpot, num(p2, 'B62'));
    compare('P2 trimestres', r.trimestres.total, num(p2, 'B14'));
    affiche();
    expect(pire()).toBeLessThanOrEqual(TOLERANCE);
  });
});
