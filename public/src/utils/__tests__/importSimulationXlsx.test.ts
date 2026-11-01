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
    ['①b Revenus foyer & PAS', toSheet(REVENUS_FOYER)],
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
