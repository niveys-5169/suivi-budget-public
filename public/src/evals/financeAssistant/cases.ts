/**
 * Cas d'évaluation de l'assistant IA, sur les données de `fixture.ts`.
 *
 * - `reference` : appel(s) d'outil qui donnent la vérité terrain ; leur
 *   résultat est vérifié par `financeAssistant.tools.test.ts` (sans LLM).
 * - `numbers` / `mustMatch` / `mustNotMatch` : critères appliqués à la
 *   réponse d'un vrai modèle par `financeAssistant.live.test.ts`.
 */

export type ToolName = 'totaux' | 'etat_budgets' | 'simuler_depense';

export interface ReferenceCall {
  tool: ToolName;
  args: Record<string, unknown>;
  /** Sous-ensemble attendu du résultat (comparé avec `toMatchObject`). */
  expected: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  question: string;
  reference: ReferenceCall[];
  /** Nombres qui doivent apparaître dans la réponse (tolérance ± 1). */
  numbers: number[];
  mustMatch?: RegExp[];
  mustNotMatch?: RegExp[];
}

/** Dérives interdites pour toutes les questions. */
export const GLOBAL_FORBIDDEN: RegExp[] = [
  /dette publique|charge de la dette|budget de l['’]([ée]tat|france)/i,
  /(conna[iî]tre|communiquer|indiquer|pr[ée]ciser|fournir).{0,25}(vos|tes) (revenus|d[ée]penses)/i,
  /il faudrait (analyser|conna[iî]tre)/i,
];

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'courses-aout',
    question: "Combien j'ai dépensé en courses en août 2026 ?",
    reference: [
      {
        tool: 'totaux',
        args: { debut: '2026-08', fin: '2026-08', categorie: 'Courses' },
        expected: { depenses: 355, nb_transactions: 3 },
      },
    ],
    numbers: [355],
  },
  {
    id: 'amazon-annee',
    question: "Combien j'ai dépensé chez Amazon cette année ?",
    reference: [
      {
        tool: 'totaux',
        args: { debut: '2026-01', fin: '2026-09', libelle: 'amazon' },
        expected: { depenses: 565, nb_transactions: 10 },
      },
    ],
    numbers: [565],
  },
  {
    id: 'restaurants-mars-avril',
    question: 'Compare mes dépenses de restaurants de mars et avril 2026.',
    reference: [
      {
        tool: 'totaux',
        args: { debut: '2026-03', fin: '2026-03', categorie: 'Restaurants' },
        expected: { depenses: 305 },
      },
      {
        tool: 'totaux',
        args: { debut: '2026-04', fin: '2026-04', categorie: 'Restaurants' },
        expected: { depenses: 105 },
      },
    ],
    numbers: [305, 105],
  },
  {
    id: 'budget-courses-mois',
    question: 'Où en est mon budget courses ce mois-ci ?',
    reference: [
      {
        tool: 'etat_budgets',
        args: { mois: '2026-09', categorie: 'Courses' },
        expected: {
          budgets_du_mois: [
            { categorie: 'Courses', budget_mensuel: 400, depense_mois: 355, reste_mois: 45 },
          ],
        },
      },
    ],
    numbers: [355, 45],
  },
  {
    id: 'budgets-depasses',
    question: 'Est-ce que je dépasse un de mes budgets ce mois-ci ?',
    reference: [
      {
        tool: 'etat_budgets',
        args: { mois: '2026-09', categorie: 'Restaurants' },
        expected: {
          budgets_du_mois: [{ categorie: 'Restaurants', depense_mois: 185, statut: 'depasse' }],
        },
      },
    ],
    numbers: [185],
    mustMatch: [/restaurant/i],
  },
  {
    id: 'enveloppe-vacances',
    question: "Combien il me reste dans l'enveloppe vacances ?",
    reference: [
      {
        tool: 'etat_budgets',
        args: { categorie: 'Vacances' },
        expected: {
          enveloppes: [{ categorie: 'Vacances', montant: 1500, reste: 1500, echeance: '2027-08' }],
        },
      },
    ],
    numbers: [1500],
  },
  {
    id: 'trottinette',
    question:
      "Est-ce que si j'achète une trottinette à 579 €, ça va poser un problème dans mon budget en fin d'année ?",
    reference: [
      {
        tool: 'simuler_depense',
        args: { montant: 579 },
        expected: { verdict: 'oui', tresorerie: { apres: { date_passage_negatif: null } } },
      },
    ],
    numbers: [579],
    mustMatch: [/\boui\b|pas de probl|aucun probl|sans probl|pouvez|peux|possible/i],
  },
  {
    id: 'solde-net-2025',
    question: 'Quel est mon solde net sur l’année 2025 ?',
    reference: [
      {
        tool: 'totaux',
        args: { debut: '2025-01', fin: '2025-12' },
        expected: { solde_net: 11790.57 },
      },
    ],
    numbers: [11790.57],
  },
  {
    id: 'top-categories',
    question: 'Quelles sont mes 3 plus grosses catégories de dépenses cette année ?',
    reference: [
      {
        tool: 'totaux',
        args: { debut: '2026-01', fin: '2026-09', grouper_par: 'categorie', limite: 3 },
        expected: {
          groupes: [
            { cle: 'Logement', depenses: 8550 },
            { cle: 'Courses', depenses: 3195 },
            { cle: 'Restaurants', depenses: 1225 },
          ],
        },
      },
    ],
    numbers: [8550, 3195, 1225],
    mustMatch: [/logement/i, /courses/i, /restaurant/i],
  },
  {
    id: 'voiture-trop-chere',
    question: "Puis-je me permettre d'acheter une voiture d'occasion à 5 500 € le 1er octobre ?",
    reference: [
      {
        tool: 'simuler_depense',
        args: { montant: 5500, date: '2026-10-01' },
        expected: { verdict: 'non', tresorerie: { apres: { date_passage_negatif: '2026-10-01' } } },
      },
    ],
    numbers: [5500],
    mustMatch: [
      /\bnon\b|pas (possible|raisonnable|conseill)|d[ée]conseill|d[ée]couvert|n[ée]gati|sous z[ée]ro/i,
    ],
  },
  {
    id: 'lisser-achat',
    question:
      'Je voudrais acheter un vélo électrique à 1 200 € (catégorie Shopping). Propose-moi une solution pour lisser la dépense.',
    reference: [
      {
        tool: 'simuler_depense',
        args: { montant: 1200, categorie: 'Shopping', nb_mensualites: 10 },
        expected: {
          paiement: { mensualite: 120 },
          tresorerie: { apres: { date_passage_negatif: null } },
        },
      },
    ],
    numbers: [],
    mustMatch: [/\b(3|4|10)\s?(x|fois)\b/i],
    mustNotMatch: [/augmenter (vos|tes) revenus|r[ée]duire d'autres d[ée]penses/i],
  },
];

/** Extrait les nombres d'une réponse en français ("11 790,57 €" donne 11790.57). */
export function extractNumbers(text: string): number[] {
  // `\s` couvre aussi les espaces insécables utilisés comme séparateur de milliers.
  const compact = text.replace(/(\d)[\s.](?=\d{3}\b)/g, '$1');
  return (compact.match(/\d+(?:,\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
}
