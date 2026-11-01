import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import type { ProjectionParams } from '../../types/banking.types';
import { createDefaultProjectionParams } from '../projection/defaults';
import { importSimulationWorkbook, importSimulationXlsx } from '../projection/importSimulationXlsx';

// Classeur synthétique : mêmes onglets et libellés génériques que le vrai classeur,
// faux prénoms (Alex = personne 1, Sam = personne 2) et fausses valeurs.
const d = (y: number, m: number, day = 1) => new Date(y, m - 1, day);
const toSheet = (aoa: unknown[][]) => XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

const HYPOTHESES = [
  ['', 'HYPOTHÈSES — TOUTES LES SAISIES'],
  [],
  ['', 'Paramètre', 'Valeur', 'Alimente', 'Source / commentaire'],
  ['', "Âge de départ à la retraite de Alex (fin de l'horizon)", 64, '①b B1', 'Donnée fournie.'],
  ['', "Âge de fin d'activité de Sam", 63, '①b B2', '⚠️ À confirmer auprès de l’employeur.'],
  ['', 'CAF (€/mois)', 150, '①b B3', 'Montant actuel.'],
  ['', 'Évolution annuelle de la CAF', 0.01, '①b B4', '⚠️ Valeur à confirmer.'],
  ['', "Date de naissance de l'enfant 1", d(2018, 2, 12), '①b B5'],
  ['', "Date de naissance de l'enfant 2", d(2020, 8, 7), '①b B6'],
  ['', "Arrêt des allocations familiales aux 20 ans de l'aîné (1 = oui, 0 = non)", 1],
  ['', 'Budget mensuel de référence, prix 2026 (calculé — pour info)', 5000.5],
  ['', 'Inflation annuelle (dépenses courantes, hors crédits)', 0.025],
  ['', 'Fin du crédit Maison', d(2041, 3, 28)],
  ['', 'Fin du crédit Maison Bis', d(2040, 5, 1)],
  ['', 'Fin du crédit voiture', d(2029, 7, 11)],
  ['', 'Remboursement anticipé voiture (1 = oui, 0 = non)', 1],
  ['', 'Date de remboursement anticipé — crédit voiture', d(2026, 11, 30)],
  ['', 'Taux nominal — crédit voiture', 0.0417],
  ['', 'Taux nominal — crédit Maison', 0.02],
  ['', 'Rendement annuel net du capital (indemnités + épargne)', 0.04],
  ['', 'Patrimoine hors PER de départ (observé) — pour info', 100000],
  ['', 'Rendement annuel du patrimoine hors PER', 0.03],
  ['', 'Abondement annuel employeur de Sam (€/an, en mars)', 3500],
  ['', 'Date de bascule en libéral (scénarios 2 à 5)', d(2036, 1)],
  ['', "Début de l'activité MJPM en association", d(2031, 3)],
  ['', 'Montée en charge libéral — année 1 (% des mesures cibles)', 0.5],
  ['', 'Montée en charge libéral — année 2', 0.75],
  ['', 'Montée en charge libéral — année 3 et suivantes', 1],
  ['', 'Tarif moyen par mesure (€/mois)', 100],
  ['', 'Versement PER TNS annuel en libéral (€/an)', 1200],
  ['', 'Coefficient CCN 66 de départ (association)', 400],
  ['', 'Valeur du point CCN 66 (€)', 4],
  ['', 'Progression annuelle du salaire en association', 0.02],
  ['', 'Durée du congé de reclassement (mois, préavis inclus)', 12],
  ['', "Taux de l'allocation de reclassement (% du brut)", 0.7],
  ['', 'Revalorisation annuelle du salaire de Sam', 0.02],
  ['', 'Âge limite de rattachement fiscal des enfants (âge au 1er janvier)', 21],
  ['', 'Rente PER / épargne retraite de Alex (€/mois brut)', 100],
  ['', 'Trimestres validés au 06/02/2026', 100],
  ['', 'Trimestres requis pour le taux plein (génération 1980)', 172],
  ['', 'Points Agirc-Arrco déjà acquis', 3000],
  ['', 'Valeur de service du point Agirc-Arrco (€)', 1.4],
  ['', 'Points Cipav acquis par an pour ~35 k€ de BNC', 380],
  ['', 'Valeur du point Cipav (€)', 0.6],
  ['', 'Prélèvements sociaux du retraité (CSG/CRDS/CASA)', 0.09],
  ['', 'Revalorisation des salaires portés au compte (inflation hors tabac)', 0.015],
  ['', 'Croissance annuelle du PASS', 0.02],
  ['', 'Part déductible de la CSG sur les pensions', 0.06],
  ['', 'Trimestres validés par Sam au 31/12/2025', 80],
  ['', 'Points Agirc-Arrco acquis par Sam au 31/12/2025', 1500],
  ['', 'Trimestres requis pour le taux plein — Sam (génération 1982)', 172],
  ['', "Prix d'achat du point Agirc-Arrco (salaire de référence, €)", 20],
  ['', '6 · DÉPENSES EXCEPTIONNELLES'],
  ['', 'Libellé', 'Montant (€)', 'Mois de la dépense', 'Commentaire'],
  ['', 'Terrasse', 40000, d(2028, 6)],
  ['', ''],
  ['', 'Voyage', 3000, d(2030, 7), 'Prévu'],
  ['', '', undefined, undefined],
  ['', 'Total des dépenses exceptionnelles', 43000],
];

const REVENUS_FOYER = [
  ['①b REVENUS DU FOYER APRÈS PAS — HYPOTHÈSES'],
  ['Crédit (non indexé)', 'Montant (€/mois)', 'Fin prévue (date)'],
  ['Crédit Maison', 1000, d(2041, 3, 28)],
  ['Crédit Maison Bis', 70, d(2040, 5, 1)],
  ['Crédit voiture', 350, d(2029, 7, 11)],
  ['Crédit Inconnu', 10],
  ['Total crédits fixes (€/mois)', 1430],
  ['Année de référence des prix', 2026],
  ['Premier mois de la projection', d(2026, 9)],
  ["Mois de versement de l'abondement (1-12)", 3],
  ['Versement PER TNS traité comme sortie de cash (1 = oui, 0 = non)', 1],
  ["Versement 1 : 95 % de l'indemnité", 46000, d(2026, 10, 18)],
  ['Versement 2 : solde de 5 %', 2400, d(2027, 7, 18)],
  ['Versement 3 : indemnité transactionnelle', 19000, d(2028, 9)],
  ['Versement 4 : solde de tout compte', 6600, d(2027, 7, 18)],
  ['Date de naissance de Alex', d(1980, 12)],
  ['Âge de départ à la retraite de Alex', 64],
  ['Date de naissance de Sam', d(1982, 11, 8)],
  ["Âge de fin d'activité de Sam", 63],
  ["Fin d'activité de Sam", d(2031, 7)],
  ["Fin de l'horizon (dernier mois projeté)", d(2030, 12)],
  ['Fin de projection (dernier mois compté)', d(2031, 12)],
  ["Date de naissance de l'enfant 1", d(2018, 2, 12)],
  ['Net avant PAS (€)', 3000],
  ['Net imposable (€)', 3300],
  ['Taux PAS Alex 2026', 0.07],
  ['Nombre de mois payés par an', 12],
  ['Ratio net imposable / net versé — revenus de remplacement', 1],
  ['Net avant PAS (€)', 2000],
  ['Net imposable (€)', 2200],
  ['Taux PAS Sam 2026', 0.04],
  ['Nombre de mois rémunérés par an', 13],
  ['Salaire brut annuel (€)', 30000],
  ['N° scénario', 'Scénario', 'Mesures cibles'],
  [1, 'Association', 0],
  [2, 'Libéral', 20],
];

const TABLEAU_DE_BORD = [
  ['', 'TABLEAU DE BORD'],
  ['', '2 · RETRAITE DE ALEX ET DU FOYER'],
  ['', 'Poste', 'S1 · Association', 'S2 · Libéral 30 mes.'],
  ['', 'Pension de base (brut)', 1700, 1200],
  ['', '💰 Retraite nette de Alex (avant impôt)', 2500, 2200],
  ['', 'Pension nette de Sam (simulation, avant impôt)', 2000, 2010],
  ['', '💰 Retraite nette du foyer', 4500, 4200],
  ['', '💶 Retraite de Alex nette APRÈS impôt (PAS)', 2400, 2100],
  ['', '💶 Pension de Sam nette APRÈS impôt (PAS)', 1900, 1950],
  ['', '💶 Retraite du foyer nette APRÈS impôt', 4300, 4050],
  ['', 'Indicateur', 'S1 · Association', 'S2 · Libéral 30 mes.'],
];

const RUPTURE = [
  ['① RUPTURE & CHÔMAGE'],
  ['Nombre de parts fiscales (QF)', 2.5],
  ['Revenu annuel imposable CONJOINT (net imposable du bulletin × 13,3)', 26000],
  ['🟡 Date de NOTIFICATION du licenciement', d(2030, 1, 2)],
  ['Délai de réflexion congé de reclassement (jours)', 8],
  ['🟡 Durée du préavis (mois)', 3],
  ['Base brut mensuel (récurrent avec 13è ÷12)', 5000],
  ['Part SUPRA-LÉGALE au sens France Travail (supra + transac.)', 4472],
  ['Indemnité compensatrice CP (brut)', 2000],
  ['🟡 Clause Agirc-Arrco active — assiette maintenue (% du salaire)', 1],
  ['Assiette mensuelle Agirc-Arrco (salaire annuel ÷ 12)', 4000],
];

const LIBERAL = [
  ['② MJPM LIBÉRAL'],
  ['🟡 Coef. CFE (création 0 % / 1re imposition 50 % / normal 100 %)', 0, 0.5, 1],
  ['🟡 Nb de mesures de référence du budget charges', 10],
  ['Maladie-maternité (0-6,5% dégressif)', 0.03, 0.04, 0.06],
  ['Loyer du bureau', '', '', '', '', 1000, 'Fixe'],
  ['Déplacements', '', '', '', '', 2000, 'Variable'],
  ['CFE', '', '', '', '', 400, 'CFE'],
  ['TOTAL CHARGES ANNUELLES', '', '', '', '', 3400],
];

const SALARIE = [
  ['②b MJPM SALARIÉ'],
  ['🟡 CTI / prime Ségur (€ brut)', 200],
  ['🟡 Cotisations salariales (%)', 0.2],
];

const SAM = [
  ['③b SAM PAR SCÉNARIO'],
  ['🟡 Revenu BNC correspondant aux 380 points Cipav de ③ B45', 35000],
  ['Année', "PASS de l'année", 'Coef.', 'Salaire brut du relevé', 'Salaire retenu'],
  [2023, 43992, 1.085, 30000, 30000],
  [2024, 46368, 1.031, undefined, 28000],
  [2025, 47100, 1.009, 32000, 32000],
  [2026, 48060, 1, undefined, 35000],
];

const ARE = [['⑥ ARE'], ['Salaire Journalier de Référence (SJR)', 200]];

const PAS = [
  ['⑫ CALCUL DES TAUX PAS'],
  ['Première année recalculée', 2031],
  ['Répartition (1 = taux individualisés, 0 = taux commun du foyer)', 1],
  ['IR libéral dans ⑤b (1 = taux recalculé × BNC imposable, 0 = IR imputé de ②)', 0],
];

interface Segment {
  label: string;
  from: [number, number];
  to: [number, number];
  value: (year: number, month: number, index: number) => number;
}

/** Onglet Calc : 4 lignes de titre, en-tête ligne 5, données dès la ligne 6 (A=mois, B=phase, G, L). */
function calcSheet(segments: Segment[], cash2: (year: number, month: number, i: number) => number) {
  const header = [
    'Mois',
    'Phase Alex',
    'Net avant PAS Alex',
    'Net imposable Alex',
    'Taux PAS Alex',
    'PAS Alex',
    'Cash Alex après PAS',
    'Net avant PAS Sam',
    'Net imposable Sam',
    'Taux PAS Sam',
    'PAS Sam',
    'Cash Sam après PAS',
    'CAF',
  ];
  const aoa: unknown[][] = [['CALCUL SCÉNARIO'], [], [], ['PÉRIODE', '', 'ALEX'], header];
  let line = 0;
  for (const seg of segments) {
    let [y, m] = seg.from;
    let i = 0;
    while (y * 12 + m <= seg.to[0] * 12 + seg.to[1]) {
      const row: unknown[] = [d(y, m), seg.label];
      row[6] = seg.value(y, m, i);
      row[11] = cash2(y, m, line);
      aoa.push(row);
      i += 1;
      line += 1;
      m += 1;
      if (m > 12) [y, m] = [y + 1, 1];
    }
  }
  aoa.push(['Total', '', 0], [d(2040, 1), 'Association', 9, 9]); // lignes après la fin : ignorées
  return toSheet(aoa);
}

// Cash 2 : mois 1 partiel, puis 1500 en 2026, 1600 en 2027 puis +2 %/an chaque janvier.
const cash2 = (y: number, m: number, i: number) =>
  i === 0 ? 1400 : y === 2026 ? 1500 : 1600 * 1.02 ** (y - 2027);

// Cash 2 du scénario 2 : +30 €/mois dès 2028 (taux de PAS propre au scénario).
const cash2S2 = (y: number, m: number, i: number) => cash2(y, m, i) + (y >= 2028 ? 30 : 0);

// Alex, scénario 1 : phase « Association » (1er mois partiel puis 2000 en 2027, +5 %/an).
const association = (y: number, m: number, i: number) =>
  i === 0 ? 1000 : y === 2027 ? 2000 : 2100 * 1.05 ** (y - 2028);

const SEGMENTS_S1: Segment[] = [
  {
    label: 'Situation actuelle',
    from: [2026, 9],
    to: [2027, 2],
    value: (_y, _m, i) => (i === 0 ? 2900 : 3000),
  },
  { label: 'Association', from: [2027, 3], to: [2029, 12], value: association },
  { label: 'Retraite', from: [2030, 1], to: [2031, 12], value: () => 3500 },
];
const SEGMENTS_S2: Segment[] = [
  { label: 'Situation actuelle', from: [2026, 9], to: [2027, 2], value: () => 3000 },
  { label: 'Libéral — 10 mesures', from: [2027, 3], to: [2027, 3], value: () => 1234 },
  { label: 'Retraite', from: [2027, 4], to: [2031, 12], value: () => 3000 },
];

function buildWorkbook(skip: string[] = []): XLSX.WorkBook {
  const sheets: [string, XLSX.WorkSheet][] = [
    ['Tableau de bord', toSheet(TABLEAU_DE_BORD)],
    ['Hypothèses', toSheet(HYPOTHESES)],
    ['① Rupture & chômage', toSheet(RUPTURE)],
    ['①b Revenus foyer & PAS', toSheet(REVENUS_FOYER)],
    ['② MJPM Libéral', toSheet(LIBERAL)],
    ['②b MJPM Salarié (Assoc.)', toSheet(SALARIE)],
    ['③b SAM par scénario', toSheet(SAM)],
    ['⑥ ARE — Calcul & Simulation', toSheet(ARE)],
    ['⑫ Calcul taux PAS', toSheet(PAS)],
    ['Calc S1', calcSheet(SEGMENTS_S1, cash2)],
    ['Calc S2', calcSheet(SEGMENTS_S2, cash2S2)],
  ];
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of sheets)
    if (!skip.includes(name)) XLSX.utils.book_append_sheet(wb, ws, name);
  return wb;
}

function makeBase(): ProjectionParams {
  const base = createDefaultProjectionParams(d(2025, 1, 15));
  base.revenusCommuns.caf.montant = { mode: 'auto' };
  base.depenses.budgetReference = { mode: 'manuel', manuel: 1 };
  base.capital.patrimoineDepart = { mode: 'auto' };
  return base;
}

describe('importSimulationWorkbook', () => {
  const base = makeBase();
  const { params, reconnus, avertissements } = importSimulationWorkbook(buildWorkbook(), base);
  const pension = (scenario: number, personneId: string) =>
    params.scenarios[scenario]!.pensions.find((p) => p.personneId === personneId);

  it("ne modifie pas `base` et n'émet aucun avertissement sur un classeur complet", () => {
    expect(base).toEqual(makeBase());
    expect(avertissements).toEqual([]);
    expect(reconnus.length).toBeGreaterThan(20);
  });

  it('lit les âges, la CAF, les enfants et la macro par libellé', () => {
    expect(params.personnes[0]?.ageFinActivite).toBe(64);
    expect(params.personnes[1]?.ageFinActivite).toBe(63);
    expect(params.revenusCommuns.caf.evolutionAnnuelle).toBe(0.01);
    expect(params.revenusCommuns.caf.arretAuxAnsAine).toBe(20);
    expect(params.enfants.map((e) => e.dateNaissance)).toEqual(['2018-02-12', '2020-08-07']);
    expect(params.macro).toEqual({
      inflation: 0.025,
      rendementCapital: 0.04,
      rendementPatrimoine: 0.03,
    });
    expect(reconnus).toContain('Évolution annuelle de la CAF');
  });

  it('renseigne manuel des valeurs auto en conservant le mode de base', () => {
    expect(params.revenusCommuns.caf.montant).toEqual({ mode: 'auto', manuel: 150 });
    expect(params.capital.patrimoineDepart).toEqual({ mode: 'auto', manuel: 100000 });
    expect(params.depenses.budgetReference).toEqual({ mode: 'manuel', manuel: 5000.5 });
  });

  it('importe les crédits exacts, taux, mensualités et remboursement anticipé', () => {
    const credits = params.depenses.credits;
    expect(credits.map((c) => c.libelle)).toEqual(['Maison', 'Maison Bis', 'voiture']);
    const [maison, bis, voiture] = credits;
    expect(maison).toMatchObject({
      mode: 'manuel',
      finManuelle: '2041-03',
      mensualiteManuelle: 1000,
      tauxAnnuelManuel: 2,
    });
    expect(maison?.remboursementAnticipe).toBeUndefined();
    expect(bis).toMatchObject({ finManuelle: '2040-05', mensualiteManuelle: 70 });
    expect(bis?.tauxAnnuelManuel).toBeUndefined();
    expect(voiture).toMatchObject({
      finManuelle: '2029-07',
      mensualiteManuelle: 350,
      tauxAnnuelManuel: 4.17,
      remboursementAnticipe: { mois: '2026-11' },
    });
  });

  it('ignore les remboursements anticipés quand le drapeau vaut 0', () => {
    const wb = buildWorkbook();
    wb.Sheets['Hypothèses']!['C16'] = { t: 'n', v: 0 };
    const result = importSimulationWorkbook(wb, makeBase());
    expect(result.params.depenses.credits.every((c) => !c.remboursementAnticipe)).toBe(true);
  });

  it('importe les dépenses exceptionnelles en ignorant les lignes vides', () => {
    expect(
      params.depenses.exceptionnelles.map(({ libelle, montant, mois }) => ({
        libelle,
        montant,
        mois,
      })),
    ).toEqual([
      { libelle: 'Terrasse', montant: 40000, mois: '2028-06' },
      { libelle: 'Voyage', montant: 3000, mois: '2030-07' },
    ]);
  });

  it('transforme les commentaires ⚠️ en points à confirmer', () => {
    expect(params.aConfirmer.map((p) => p.libelle)).toEqual([
      "Âge de fin d'activité de Sam",
      'Évolution annuelle de la CAF',
    ]);
    expect(params.aConfirmer[1]).toEqual({
      id: 'evolution-annuelle-de-la-caf',
      libelle: 'Évolution annuelle de la CAF',
      commentaire: '⚠️ Valeur à confirmer.',
    });
  });

  it("lit l'horizon, les personnes, l'abondement et les encaissements dans ①b", () => {
    expect(params.horizon).toEqual({ debut: '2026-09', fin: '2031-12', anneeReferencePrix: 2026 });
    expect(params.personnes[0]).toMatchObject({ prenom: 'Alex', dateNaissance: '1980-12-01' });
    expect(params.personnes[1]).toMatchObject({ prenom: 'Sam', dateNaissance: '1982-11-08' });
    expect(params.capital.abondement).toEqual({ montantAnnuel: 3500, mois: 3, finMois: '2031-06' });
    expect(params.capital.encaissements.map((e) => [e.montant, e.mois])).toEqual([
      [46000, '2026-10'],
      [2400, '2027-07'],
      [19000, '2028-09'],
      [6600, '2027-07'],
    ]);
  });

  it('crée un scénario par onglet Calc, nommé par le Tableau de bord', () => {
    expect(params.scenarios.map((s) => [s.id, s.nom])).toEqual([
      ['s1', 'S1 · Association'],
      ['s2', 'S2 · Libéral 30 mes.'],
    ]);
    expect(params.scenarioAfficheId).toBe('s1');
  });

  it('découpe les phases par séries, hors Retraite, avec montant du 2e mois et croissance', () => {
    const phases = params.scenarios[0]!.phases.filter((p) => p.personneId === 'p1');
    expect(phases.map((p) => [p.libelle, p.debut, p.fin])).toEqual([
      ['Situation actuelle', '2026-09', '2027-02'],
      ['Association', '2027-03', '2029-12'],
    ]);
    expect(phases[0]).toMatchObject({
      personneId: 'p1',
      netMensuel: { mode: 'manuel', manuel: 3000 },
      revalorisationAnnuelle: 0,
    });
    expect(phases[1]?.netMensuel).toEqual({ mode: 'manuel', manuel: 2000 });
    expect(phases[1]?.revalorisationAnnuelle).toBeCloseTo(0.05, 10);
    const single = params.scenarios[1]!.phases[1];
    expect(single).toMatchObject({
      libelle: 'Libéral — 10 mesures',
      debut: '2027-03',
      fin: '2027-03',
      netMensuel: { manuel: 1234 },
    });
  });

  it('renseigne montantsAnnuels : moyenne par année civile, 1er mois partiel exclu', () => {
    const [situation, association] = params.scenarios[0]!.phases;
    expect(situation?.montantsAnnuels).toEqual({ '2026': 3000, '2027': 3000 });
    expect(association?.montantsAnnuels?.['2027']).toBe(2000); // le 1er mois (1000) est ignoré
    expect(association?.montantsAnnuels?.['2028']).toBeCloseTo(2100, 6);
    expect(association?.montantsAnnuels?.['2029']).toBeCloseTo(2205, 6);
    // 1er mois seul de son année : conservé
    expect(params.scenarios[1]!.phases[1]?.montantsAnnuels).toEqual({ '2027': 1234 });
    const activite = params.scenarios[0]!.phases.find((p) => p.id === 's1-p2-activite');
    expect(activite?.montantsAnnuels?.['2026']).toBe(1500);
    expect(activite?.montantsAnnuels?.['2027']).toBe(1600);
    expect(activite?.montantsAnnuels?.['2031']).toBeCloseTo(1600 * 1.02 ** 4, 6);
  });

  it('renseigne montantsAnnuels des pensions (tous les mois de retraite comptent)', () => {
    expect(pension(0, 'p1')?.montantsAnnuels).toEqual({
      '2030': 3500,
      '2031': 3500,
    });
    expect(pension(1, 'p1')?.montantsAnnuels).toEqual({
      '2027': 3000,
      '2028': 3000,
      '2029': 3000,
      '2030': 3000,
      '2031': 3000,
    });
    expect(pension(0, 'p2')?.montantsAnnuels).toEqual({ '2031': 1600 * 1.02 ** 4 });
    expect(pension(1, 'p2')?.montantsAnnuels).toEqual({ '2031': 1600 * 1.02 ** 4 + 30 });
  });

  it('crée une phase Activité de la personne 2 par scénario, lue dans son onglet Calc', () => {
    const [s1, s2] = params.scenarios;
    for (const [scenario, id, cash2031] of [
      [s1, 's1-p2-activite', 1600 * 1.02 ** 4],
      [s2, 's2-p2-activite', 1600 * 1.02 ** 4 + 30],
    ] as const) {
      const phase = scenario!.phases.find((p) => p.id === id);
      expect(phase).toMatchObject({
        personneId: 'p2',
        libelle: 'Activité',
        debut: '2026-09',
        fin: '2031-06',
      });
      expect(phase?.netMensuel).toEqual({ mode: 'manuel', manuel: 1500 });
      expect(phase?.montantsAnnuels?.['2031']).toBeCloseTo(cash2031, 6);
    }
    expect(s2!.phases.find((p) => p.id === 's2-p2-activite')?.montantsAnnuels).toMatchObject({
      '2027': 1600,
      '2028': 1600 * 1.02 + 30,
    });
    expect(s1!.phases.find((p) => p.id === 's1-p2-activite')?.revalorisationAnnuelle).toBeCloseTo(
      0.02,
      10,
    );
  });

  it('n écrit plus de phase d écart ni de phase ou pension commune pour la personne 2', () => {
    const ids = params.scenarios.flatMap((s) => s.phases.map((p) => p.id));
    expect(ids.some((id) => id.includes('ecart'))).toBe(false);
    expect(params.revenusCommuns.phases).toEqual([]);
    expect(params.revenusCommuns.pensions).toEqual([]);
  });

  it('retire les phases et pensions communes de la personne 2 d un import précédent', () => {
    const old = makeBase();
    const commun = { personneId: 'p2', debut: '2026-01', netAvantImpot: 1, netApresImpot: 1 };
    old.revenusCommuns.pensions = [{ id: 'commun-pension-2', ...commun }];
    old.revenusCommuns.phases = [
      {
        id: 'commun-activite',
        personneId: 'p2',
        libelle: 'Activité',
        debut: '2026-01',
        netMensuel: { mode: 'manuel', manuel: 1 },
        revalorisationAnnuelle: 0,
      },
    ];
    const result = importSimulationWorkbook(buildWorkbook(), old).params.revenusCommuns;
    expect(result.phases).toEqual([]);
    expect(result.pensions).toEqual([]);
  });

  it('importe la pension de la personne 1 et celle de la personne 2 dans chaque scénario', () => {
    expect(params.scenarios[0]!.pensions).toEqual([
      expect.objectContaining({
        id: 's1-pension-1',
        personneId: 'p1',
        debut: '2030-01',
        netAvantImpot: 2500,
        netApresImpot: 2400,
      }),
      expect.objectContaining({
        id: 's1-p2-pension',
        personneId: 'p2',
        debut: '2031-07',
        netAvantImpot: 2000,
        netApresImpot: 1900,
      }),
    ]);
    expect(params.scenarios[1]!.pensions[0]).toMatchObject({
      debut: '2027-04',
      netAvantImpot: 2200,
      netApresImpot: 2100,
    });
    expect(params.scenarios[1]!.pensions[1]).toMatchObject({
      id: 's2-p2-pension',
      personneId: 'p2',
      debut: '2031-07',
      netAvantImpot: 2010,
      netApresImpot: 1950,
    });
  });

  describe('paramètres des calculateurs', () => {
    const calc = params.calculateurs!;

    it('inactifs par défaut, reconnus, et sans avertissement', () => {
      expect(calc.actif).toBe(false);
      expect(reconnus).toContain('Calculateurs : fiscal, retraite et activité');
    });

    it('fiscal : ⑫, Hypothèses et ①b par libellé', () => {
      expect(calc.fiscal).toEqual({
        indexationBareme: { mode: 'inflation' },
        ageLimiteRattachement: 21,
        tauxIndividualises: true,
        premiereAnneeRecalculee: 2031,
        tauxReelsActuels: { p1: 0.07, p2: 0.04 },
        irLiberalParTaux: false,
      });
    });

    it('retraite : une entrée par personne, salaires du relevé (retenu à défaut)', () => {
      expect(calc.retraite?.partCsgDeductible).toBe(0.06);
      expect(calc.retraite?.personnes[0]).toEqual({
        personneId: 'p1',
        trimestresValides: 100,
        anneeReleve: 2025,
        trimestresRequis: 172,
        pointsAgircArrco: 3000,
        valeurPointAgircArrco: 1.4,
        prixPointAgircArrco: 20,
        pointsCipavParAn: 380,
        bncReferenceCipav: 35000,
        valeurPointCipav: 0.6,
        rentePerMensuelle: 100,
        tauxPrelevementsSociaux: 0.09,
        revalorisationSalaires: 0.015,
        croissancePass: 0.02,
        nombreMeilleuresAnnees: 25,
        salairesPasses: { '2023': 30000, '2024': 28000, '2025': 32000 },
      });
      expect(calc.retraite?.personnes[1]).toMatchObject({
        personneId: 'p2',
        trimestresValides: 80,
        trimestresRequis: 172,
        pointsAgircArrco: 1500,
        pointsCipavParAn: 0,
        rentePerMensuelle: 0,
      });
      expect(calc.retraite?.personnes[1]?.salairesPasses).toBeUndefined();
    });

    it('activité : paie, calendrier, reclassement, ARE, CCN 66, personne 2 et scénarios', () => {
      const a = calc.activite!;
      expect(a.personne1).toEqual({ dateNaissance: '1980-12-01', ageDepartRetraite: 64 });
      expect(a.paie).toEqual({
        netAvantPas: 3000,
        netImposable: 3300,
        moisPayesParAn: 12,
        ratioImposableRemplacement: 1,
      });
      expect(a.calendrier).toEqual({
        dateNotification: '2030-01-02',
        delaiReflexionJours: 8,
        dureePreavisMois: 3,
        dureeCongeMois: 12,
        debutAssociation: '2031-03-01',
        dateBasculeLiberal: '2036-01-01',
      });
      expect(a.reclassement).toEqual({
        tauxAllocation: 0.7,
        brutMensuelReference: 5000,
        assietteAgircArrcoMensuelle: 4000,
      });
      expect(a.are).toEqual({ sjr: 200, assietteSupralegale: 4472, iccpBrute: 2000 });
      expect(a.ccn66).toEqual({
        coefficient: 400,
        valeurPoint: 4,
        cti: 200,
        tauxCotisationsSalariales: 0.2,
        progressionAnnuelle: 0.02,
      });
      expect(a.scenarios).toEqual({ s1: 0, s2: 20 });
      expect(a.irImpute).toEqual({ revenuImposableAutrePersonne: 26000, parts: 2.5 });
      expect(a.personne2).toEqual({
        dateNaissance: '1982-11-08',
        ageFinActivite: 63,
        netAvantPasMensuel: (2000 * 13) / 12,
        netImposableMensuel: (2200 * 13) / 12,
        salaireBrutAnnuel: 30000,
        revalorisationAnnuelle: 0.02,
        anneeReference: 2026,
      });
    });

    it('libéral : tarif, montée en charge, charges classées par nature, cotisations, PER', () => {
      expect(calc.activite?.liberal).toEqual({
        tarifMesure: 100,
        monteeEnCharge: [0.5, 0.75, 1],
        mesuresReference: 10,
        charges: [
          { libelle: 'Loyer du bureau', montantReference: 1000, nature: 'fixe' },
          { libelle: 'Déplacements', montantReference: 2000, nature: 'variable' },
          { libelle: 'CFE', montantReference: 400, nature: 'cfe' },
        ],
        coefficientCfe: [0, 0.5, 1],
        perAnnuel: 1200,
        perSortieDeCash: true,
        tauxMaladieMaternite: [0.03, 0.04, 0.06],
      });
    });

    it('conserve le choix d activation de base et avertit quand des onglets manquent', () => {
      const actif = makeBase();
      actif.calculateurs = { actif: true };
      const complet = importSimulationWorkbook(buildWorkbook(), actif);
      expect(complet.params.calculateurs?.actif).toBe(true);
      const sans = importSimulationWorkbook(
        buildWorkbook(['② MJPM Libéral', '⑫ Calcul taux PAS']),
        makeBase(),
      );
      expect(sans.avertissements.join('\n')).toContain('Calculateurs : onglets introuvables');
      expect(sans.avertissements.join('\n')).toContain('mjpm liberal');
      expect(sans.params.calculateurs).toBeUndefined();
    });
  });

  it('avertit et conserve base quand des onglets manquent', () => {
    const wb = buildWorkbook(['Hypothèses', 'Calc S1', 'Calc S2']);
    const result = importSimulationWorkbook(wb, makeBase());
    const text = result.avertissements.join('\n');
    expect(text).toContain('Hypothèses');
    expect(text).toContain('Calc S1');
    expect(result.params.scenarios).toEqual(makeBase().scenarios);
    expect(result.params.macro).toEqual(makeBase().macro);
    expect(result.params.horizon.fin).toBe('2031-12'); // ①b reste lu
  });

  it('avertit pour un onglet ①b ou Tableau de bord absent', () => {
    const result = importSimulationWorkbook(
      buildWorkbook(['①b Revenus foyer & PAS', 'Tableau de bord']),
      makeBase(),
    );
    expect(result.avertissements.join('\n')).toContain('①b');
    expect(result.avertissements.join('\n')).toContain('Tableau de bord');
    expect(result.params.scenarios).toHaveLength(2);
  });
});

describe('importSimulationXlsx', () => {
  it('lit un ArrayBuffer .xlsx', async () => {
    const data = XLSX.write(buildWorkbook(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = await importSimulationXlsx(data, makeBase());
    expect(result.params.scenarios).toHaveLength(2);
    expect(result.params.horizon.debut).toBe('2026-09');
    expect(result.params.depenses.credits[2]?.remboursementAnticipe?.mois).toBe('2026-11');
  });
});
