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
}

export function simulerDepense(args: SimulationArgs, ctx: FinanceToolsContext) {
  const today = ctx.today ?? new Date();
  const montant = Math.abs(Number(args.montant));
  if (!Number.isFinite(montant) || montant === 0) {
    throw new Error('"montant" doit être un nombre positif.');
  }
  const todayKey = toDateKey(today);
  const date = optionalString(args.date) ?? todayKey;
  if (!DATE_RE.test(date)) throw new Error('"date" doit être au format YYYY-MM-DD.');
  const categorie = optionalString(args.categorie);
  const raisons: string[] = [];

  // Trésorerie : l'achat est retranché du solde projeté à partir de sa date.
  const days = ctx.forecast.days;
  const lowest = (shift: number) => {
    let point = { date: days[0]?.date ?? todayKey, solde: Infinity };
    let negatif: string | null = null;
    for (const d of days) {
      const solde = d.date >= date ? d.balance - shift : d.balance;
      if (solde < point.solde) point = { date: d.date, solde };
      if (negatif === null && solde < 0) negatif = d.date;
    }
    return {
      point_bas: { date: point.date, solde: round(point.solde) },
      date_passage_negatif: negatif,
    };
  };
  const avant = lowest(0);
  const apres = lowest(montant);
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
      budget = {
        type: 'mensuel',
        categorie: line.categorie,
        mois: status.mois,
        budget: line.budget_mensuel,
        reste_avant: line.reste_mois,
        reste_apres: round(line.reste_mois - montant),
      };
    } else if (env) {
      budget = {
        type: 'enveloppe',
        categorie: env.categorie,
        echeance: env.echeance,
        montant: env.montant,
        reste_avant: env.reste,
        reste_apres: round(env.reste - montant),
      };
    }
    if (budget && (budget.reste_apres as number) < 0) {
      raisons.push(
        `Le budget « ${budget.categorie} » serait dépassé de ${round(-(budget.reste_apres as number))} €.`,
      );
    }
  }

  // Marge annuelle : solde net projeté de l'année (moyennes des 12 derniers mois).
  const projection = buildYearEndProjection(ctx.transactions, today);
  const marge = projection
    ? {
        solde_net_annuel_projete_avant: projection.solde_net_annuel_projete,
        solde_net_annuel_projete_apres: round(projection.solde_net_annuel_projete - montant),
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
    tresorerie: {
      horizon,
      solde_actuel: round(days[0]?.balance ?? 0),
      avant,
      apres,
    },
    budget_categorie: categorie ? (budget ?? 'aucun budget pour cette catégorie') : null,
    marge_annuelle: marge,
    hypotheses:
      'Trésorerie projetée avec les seules échéances récurrentes (hors dépenses variables comme les courses) ; marge annuelle basée sur la moyenne des 12 derniers mois.',
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
        "Simule l'impact d'une dépense ponctuelle (achat envisagé) : trésorerie des comptes courants jusqu'à la fin d'année (point bas, passage sous zéro), budget ou enveloppe de la catégorie, marge annuelle ; renvoie un verdict indicatif (oui / oui_mais / non) et ses raisons. À utiliser pour toute question « puis-je me permettre », « est-ce que cet achat pose problème ».",
      parameters: {
        type: 'object',
        properties: {
          montant: { type: 'number', description: 'Montant de la dépense en euros (positif).' },
          date: { type: 'string', description: 'Date prévue (YYYY-MM-DD). Défaut : aujourd’hui.' },
          categorie: { type: 'string', description: 'Catégorie de budget concernée, si connue.' },
        },
        required: ['montant'],
      },
      run: (args) => json(simulerDepense(args as SimulationArgs, ctx)),
    },
  ];
}
