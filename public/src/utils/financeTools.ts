import type { BudgetBase, Transaction } from '../types/banking.types';
import type { LLMTool } from '../services/llmClient';
import type { CashflowForecast } from './computeCashflowForecast';
import { buildMonthBudgetStatus } from './budgetQAAnalysis';
import {
  buildYearEndProjection,
  extractSignificantTokens,
  normalizeText,
} from './financeQAAnalysis';
import { categoryKey } from './budgetHelpers';
import { getAssignedMonthKey } from './date';
import {
  PATRIMONIAL_FLOW_CATEGORY_ALIASES,
  normalizeFlowCategory,
} from '../constants/transactionFlowCategories';

/**
 * Outils métier exposés à l'assistant IA (function calling) : le modèle
 * demande un calcul, l'app le fait exactement sur les données de l'utilisateur.
 */

export interface FinanceToolsContext {
  transactions: Transaction[];
  baseBudgets: BudgetBase[];
  /** Prévisionnel de trésorerie (récurrences + revenus RAV). */
  forecast: CashflowForecast;
  today?: Date;
}

const round = (n: number) => Math.round(n * 100) / 100;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PATRIMONIAL_FLOWS = new Set<string>(
  PATRIMONIAL_FLOW_CATEGORY_ALIASES.map(normalizeFlowCategory),
);

const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const toDateKey = (d: Date) => `${toMonthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;

function monthArg(value: unknown, name: string, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || !MONTH_RE.test(value)) {
    throw new Error(`"${name}" doit être au format YYYY-MM.`);
  }
  return value;
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

// --- totaux ---------------------------------------------------------------

export type GroupBy = 'aucun' | 'mois' | 'categorie' | 'libelle';

export interface TotauxArgs {
  debut?: string;
  fin?: string;
  categorie?: string;
  libelle?: string;
  grouper_par?: GroupBy;
  limite?: number;
}

interface Totals {
  depenses: number;
  recettes: number;
  solde_net: number;
  nb_transactions: number;
}

const MAX_GROUPS = 40;

export function computeTotaux(args: TotauxArgs, ctx: FinanceToolsContext) {
  const today = ctx.today ?? new Date();
  const debut = monthArg(args.debut, 'debut', `${today.getFullYear()}-01`);
  const fin = monthArg(args.fin, 'fin', toMonthKey(today));
  const categorie = optionalString(args.categorie);
  const libelle = optionalString(args.libelle);
  const groupBy: GroupBy = args.grouper_par ?? 'aucun';
  const catKey = categorie ? categoryKey(categorie) : undefined;
  const tokens = libelle ? extractSignificantTokens(libelle) : [];
  const labelNeedle = libelle ? normalizeText(libelle) : '';

  const matches = ctx.transactions.filter((tx) => {
    const m = getAssignedMonthKey(tx);
    if (!m || m < debut || m > fin) return false;
    if (catKey !== undefined) {
      if (categoryKey(tx.categorie) !== catKey) return false;
    } else if (PATRIMONIAL_FLOWS.has(normalizeFlowCategory(tx.categorie))) {
      // Virements internes et flux d'épargne faussent dépenses/recettes.
      return false;
    }
    if (libelle) {
      const text = normalizeText(`${tx.libelle || ''} ${tx.commentaire || ''}`);
      const ok = tokens.length ? tokens.every((t) => text.includes(t)) : text.includes(labelNeedle);
      if (!ok) return false;
    }
    return true;
  });

  const sum = (txs: Transaction[]): Totals => {
    let depenses = 0;
    let recettes = 0;
    for (const tx of txs) {
      const montant = Number(tx.montant) || 0;
      if (montant < 0) depenses -= montant;
      else recettes += montant;
    }
    return {
      depenses: round(depenses),
      recettes: round(recettes),
      solde_net: round(recettes - depenses),
      nb_transactions: txs.length,
    };
  };

  const result: Record<string, unknown> = {
    periode: { debut, fin },
    filtres: { categorie: categorie ?? null, libelle: libelle ?? null },
    ...sum(matches),
  };

  if (groupBy !== 'aucun') {
    const groups = new Map<string, Transaction[]>();
    for (const tx of matches) {
      const key =
        groupBy === 'mois'
          ? getAssignedMonthKey(tx)
          : groupBy === 'categorie'
            ? tx.categorie || 'Sans catégorie'
            : (tx.libelle || '').trim().toUpperCase() || '(sans libellé)';
      const list = groups.get(key) ?? [];
      list.push(tx);
      groups.set(key, list);
    }
    const rows = [...groups.entries()].map(([cle, txs]) => ({ cle, ...sum(txs) }));
    rows.sort((a, b) =>
      groupBy === 'mois' ? a.cle.localeCompare(b.cle) : b.depenses - a.depenses,
    );
    const limit = Math.min(Math.max(Math.floor(Number(args.limite)) || MAX_GROUPS, 1), MAX_GROUPS);
    result.groupes = rows.slice(0, limit);
    if (rows.length > limit) result.groupes_non_affiches = rows.length - limit;
  }

  if (!matches.length && categorie) {
    // Aide le modèle à se corriger si la catégorie est mal orthographiée.
    result.categories_disponibles = [
      ...new Set(ctx.transactions.map((t) => t.categorie).filter(Boolean)),
    ].sort();
  }
  return result;
}

// --- etat_budgets ---------------------------------------------------------

export function computeEtatBudgets(
  args: { mois?: string; categorie?: string },
  ctx: FinanceToolsContext,
) {
  const today = ctx.today ?? new Date();
  const mois = monthArg(args.mois, 'mois', toMonthKey(today));
  const status = buildMonthBudgetStatus(ctx.transactions, ctx.baseBudgets, mois, today);
  const categorie = optionalString(args.categorie);
  if (!categorie) return status;
  const key = categoryKey(categorie);
  return {
    ...status,
    budgets_du_mois: status.budgets_du_mois.filter((l) => categoryKey(l.categorie) === key),
    enveloppes: status.enveloppes.filter((e) => categoryKey(e.categorie) === key),
  };
}

// --- simuler_depense ------------------------------------------------------

export interface SimulationArgs {
  montant?: number;
  date?: string;
  categorie?: string;
  /** Paiement fractionné : nombre de mensualités (1 = comptant). */
  nb_mensualites?: number;
  /** Frais totaux du paiement fractionné, en euros. */
  frais?: number;
}

const MAX_INSTALLMENTS = 48;

/** Même jour `months` mois plus tard, borné au dernier jour du mois. */
function addMonths(dateKey: string, months: number): string {
  const [y = NaN, m = NaN, d = NaN] = dateKey.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + months + 1, 0).getDate();
  return toDateKey(new Date(y, m - 1 + months, Math.min(d, lastDay)));
}

/** Dépense nette mensuelle moyenne d'une catégorie sur les 12 mois complets avant `monthKey`. */
function averageMonthlySpent(txs: Transaction[], key: string, monthKey: string): number {
  const [y = NaN, m = NaN] = monthKey.split('-').map(Number);
  const start = toMonthKey(new Date(y - 1, m - 1, 1));
  let total = 0;
  for (const tx of txs) {
    if (tx.categorie === 'Virement interne' || categoryKey(tx.categorie) !== key) continue;
    const mk = getAssignedMonthKey(tx);
    if (mk >= start && mk < monthKey) total -= Number(tx.montant) || 0;
  }
  return total / 12;
}

export function simulerDepense(args: SimulationArgs, ctx: FinanceToolsContext) {
  const today = ctx.today ?? new Date();
  const montant = Math.abs(Number(args.montant));
  if (!Number.isFinite(montant) || montant === 0) {
    throw new Error('"montant" doit être un nombre positif.');
  }
  const todayKey = toDateKey(today);
  const currentMonth = toMonthKey(today);
  const date = optionalString(args.date) ?? todayKey;
  if (!DATE_RE.test(date)) throw new Error('"date" doit être au format YYYY-MM-DD.');
  const categorie = optionalString(args.categorie);
  const n = Math.min(Math.max(Math.floor(Number(args.nb_mensualites)) || 1, 1), MAX_INSTALLMENTS);
  const frais = Math.max(Number(args.frais) || 0, 0);
  const raisons: string[] = [];

  // Échéancier : mensualités égales, la dernière absorbe l'arrondi.
  const coutTotal = round(montant + frais);
  const mensualite = round(coutTotal / n);
  const echeances = Array.from({ length: n }, (_, i) => ({
    date: addMonths(date, i),
    montant: i === n - 1 ? round(coutTotal - mensualite * (n - 1)) : mensualite,
  }));

  // Trésorerie : chaque échéance est retranchée du solde projeté à partir de sa date.
  const days = ctx.forecast.days;
  const lowest = (withPurchase: boolean) => {
    let point = { date: days[0]?.date ?? todayKey, solde: Infinity };
    let negatif: string | null = null;
    for (const d of days) {
      const paid = withPurchase
        ? echeances.reduce((s, e) => (e.date <= d.date ? s + e.montant : s), 0)
        : 0;
      const solde = d.balance - paid;
      if (solde < point.solde) point = { date: d.date, solde };
      if (negatif === null && solde < 0) negatif = d.date;
    }
    return {
      point_bas: { date: point.date, solde: round(point.solde) },
      date_passage_negatif: negatif,
    };
  };
  const avant = lowest(false);
  const apres = lowest(true);
  const horizon = days[days.length - 1]?.date ?? todayKey;
  if (apres.date_passage_negatif) {
    raisons.push(`Les comptes courants passeraient sous zéro le ${apres.date_passage_negatif}.`);
  }

  // Budget ou enveloppe de la catégorie.
  let budget: Record<string, unknown> | null = null;
  if (categorie) {
    const key = categoryKey(categorie);
    const status = buildMonthBudgetStatus(
      ctx.transactions,
      ctx.baseBudgets,
      date.slice(0, 7),
      today,
    );
    const line = status.budgets_du_mois.find((l) => categoryKey(l.categorie) === key);
    const env = status.enveloppes.find((e) => categoryKey(e.categorie) === key);
    if (line) {
      // Mois passés/en cours : dépense réelle ; mois futurs : dépense habituelle.
      const habituel = averageMonthlySpent(ctx.transactions, key, currentMonth);
      const parMois = echeances.map((e) => {
        const mois = e.date.slice(0, 7);
        const depensePrevue =
          mois <= currentMonth
            ? (buildMonthBudgetStatus(
                ctx.transactions,
                ctx.baseBudgets,
                mois,
                today,
              ).budgets_du_mois.find((l) => categoryKey(l.categorie) === key)?.depense_mois ?? 0)
            : habituel;
        return {
          mois,
          depense_prevue_hors_achat: round(depensePrevue),
          echeance: e.montant,
          reste_apres: round(line.budget_mensuel - depensePrevue - e.montant),
        };
      });
      const depassements = parMois.filter((p) => p.reste_apres < 0);
      budget = {
        type: 'mensuel',
        categorie: line.categorie,
        budget: line.budget_mensuel,
        depense_mensuelle_habituelle: round(habituel),
        reste_avant: line.reste_mois,
        reste_apres: parMois[0]!.reste_apres,
        ...(n > 1 ? { par_mois: parMois } : {}),
      };
      if (depassements.length) {
        const pire = Math.min(...depassements.map((p) => p.reste_apres));
        raisons.push(
          n > 1
            ? `Le budget « ${line.categorie} » serait dépassé ${depassements.length} mois sur ${n} (jusqu'à ${round(-pire)} €).`
            : `Le budget « ${line.categorie} » serait dépassé de ${round(-pire)} €.`,
        );
      }
    } else if (env) {
      const dansLeCycle = echeances
        .filter((e) => e.date.slice(0, 7) <= env.echeance)
        .reduce((s, e) => s + e.montant, 0);
      budget = {
        type: 'enveloppe',
        categorie: env.categorie,
        echeance: env.echeance,
        montant: env.montant,
        reste_avant: env.reste,
        reste_apres: round(env.reste - dansLeCycle),
      };
      if ((budget.reste_apres as number) < 0) {
        raisons.push(
          `L'enveloppe « ${env.categorie} » serait dépassée de ${round(-(budget.reste_apres as number))} €.`,
        );
      }
    }
  }

  // Marge annuelle : seules les échéances de l'année en cours pèsent dessus.
  const projection = buildYearEndProjection(ctx.transactions, today);
  const payeCetteAnnee = echeances
    .filter((e) => e.date.startsWith(String(today.getFullYear())))
    .reduce((s, e) => s + e.montant, 0);
  const marge = projection
    ? {
        solde_net_annuel_projete_avant: projection.solde_net_annuel_projete,
        solde_net_annuel_projete_apres: round(projection.solde_net_annuel_projete - payeCetteAnnee),
      }
    : null;
  if (marge && marge.solde_net_annuel_projete_apres < 0) {
    raisons.push("L'année se terminerait avec plus de dépenses que de revenus.");
  }

  const verdict = apres.date_passage_negatif ? 'non' : raisons.length ? 'oui_mais' : 'oui';

  return {
    montant: round(montant),
    date,
    verdict,
    raisons,
    paiement: {
      nb_mensualites: n,
      mensualite,
      frais: round(frais),
      cout_total: coutTotal,
      ...(n > 1 ? { echeances } : {}),
    },
    tresorerie: {
      horizon,
      solde_actuel: round(days[0]?.balance ?? 0),
      avant,
      apres,
    },
    budget_categorie: categorie ? (budget ?? 'aucun budget pour cette catégorie') : null,
    marge_annuelle: marge,
    hypotheses:
      "Trésorerie projetée avec les seules échéances récurrentes (hors dépenses variables comme les courses), jusqu'à l'horizon ; mois futurs du budget estimés avec la dépense habituelle de la catégorie ; marge annuelle basée sur la moyenne des 12 derniers mois.",
  };
}

// --- Déclarations ----------------------------------------------------------

const MONTH_SCHEMA = { type: 'string', description: 'Mois au format YYYY-MM.' };

export function buildFinanceTools(ctx: FinanceToolsContext): LLMTool[] {
  const json = (value: unknown) => JSON.stringify(value);
  return [
    {
      name: 'totaux',
      description:
        "Calcule exactement les dépenses, recettes et solde net de l'utilisateur sur une période (mois d'affectation), avec filtres optionnels par catégorie ou par libellé (marchand, mot du commentaire) et regroupement optionnel. Les montants de dépenses sont positifs. Sans filtre de catégorie, les virements internes et flux d'épargne sont exclus. À utiliser pour toute question « combien », comparaison de périodes ou classement.",
      parameters: {
        type: 'object',
        properties: {
          debut: {
            ...MONTH_SCHEMA,
            description: 'Premier mois inclus (YYYY-MM). Défaut : janvier de l’année en cours.',
          },
          fin: {
            ...MONTH_SCHEMA,
            description: 'Dernier mois inclus (YYYY-MM). Défaut : mois en cours.',
          },
          categorie: { type: 'string', description: 'Catégorie exacte (ex. « Courses »).' },
          libelle: {
            type: 'string',
            description: 'Texte recherché dans le libellé ou le commentaire (ex. « amazon »).',
          },
          grouper_par: {
            type: 'string',
            enum: ['aucun', 'mois', 'categorie', 'libelle'],
            description: 'Regroupement du résultat. Défaut : aucun.',
          },
          limite: {
            type: 'number',
            description:
              'Nombre maximal de groupes renvoyés (ex. 3 pour un top 3). Défaut et maximum : 40.',
          },
        },
      },
      run: (args) => json(computeTotaux(args as TotauxArgs, ctx)),
    },
    {
      name: 'etat_budgets',
      description:
        "État des budgets d'un mois, comme l'écran Budgets : pour chaque budget mensuel de dépense, budget, dépensé, reste, % consommé, projection fin de mois, statut et cumul annuel ; plus les enveloppes annuelles (reste, échéance).",
      parameters: {
        type: 'object',
        properties: {
          mois: { ...MONTH_SCHEMA, description: 'Mois (YYYY-MM). Défaut : mois en cours.' },
          categorie: { type: 'string', description: 'Limite le résultat à une catégorie.' },
        },
      },
      run: (args) => json(computeEtatBudgets(args as { mois?: string; categorie?: string }, ctx)),
    },
    {
      name: 'simuler_depense',
      description:
        "Simule l'impact d'un achat envisagé, payé comptant ou en plusieurs fois : trésorerie des comptes courants jusqu'à la fin d'année (point bas, passage sous zéro), budget ou enveloppe de la catégorie mois par mois, marge annuelle ; renvoie un verdict indicatif (oui / oui_mais / non) et ses raisons. À utiliser pour toute question « puis-je me permettre », « est-ce que cet achat pose problème », et pour comparer des options (comptant, 3x, 4x, 10x, achat décalé).",
      parameters: {
        type: 'object',
        properties: {
          montant: { type: 'number', description: 'Montant de la dépense en euros (positif).' },
          date: { type: 'string', description: 'Date prévue (YYYY-MM-DD). Défaut : aujourd’hui.' },
          categorie: { type: 'string', description: 'Catégorie de budget concernée, si connue.' },
          nb_mensualites: {
            type: 'number',
            description:
              'Paiement fractionné : nombre de mensualités (3, 4, 10…). Défaut : 1 (comptant).',
          },
          frais: {
            type: 'number',
            description:
              'Frais totaux du paiement fractionné en euros, si connus. Défaut : 0 (sans frais).',
          },
        },
        required: ['montant'],
      },
      run: (args) => json(simulerDepense(args as SimulationArgs, ctx)),
    },
  ];
}
