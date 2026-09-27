import type { BudgetBase, Transaction } from '../types/banking.types';
import type { CashflowForecast } from './computeCashflowForecast';
import { computeEnvelope, isEnvelope } from './annualEnvelope';
import { categoryKey } from './budgetHelpers';
import { getAssignedMonthKey } from './date';

/**
 * Vue « budgets » pour l'assistant IA : consommation des budgets du mois,
 * enveloppes annuelles et engagements récurrents à venir, calculés avec les
 * mêmes règles que les écrans Budgets, Enveloppes et Prévisionnel.
 */

export interface BudgetLineSummary {
  categorie: string;
  budget_mensuel: number;
  depense_mois: number;
  reste_mois: number;
  pct_consomme: number;
  /** Dépense projetée fin de mois au rythme actuel. */
  projection_fin_mois: number;
  statut: 'ok' | 'a_surveiller' | 'depasse';
  budget_annee: number;
  depense_annee: number;
  reste_annee: number;
}

export interface BudgetSummary {
  mois: string;
  jours_ecoules: number;
  jours_du_mois: number;
  budgets_du_mois: BudgetLineSummary[];
  total_budgets_mois: { budget: number; depense: number; reste: number };
  enveloppes: {
    categorie: string;
    montant: number;
    depense: number;
    reste: number;
    echeance: string;
    provision_mensuelle: number;
  }[];
  engagements_a_venir: {
    jusqu_au: string;
    total_depenses: number;
    total_revenus: number;
    detail: { libelle: string; montant_unitaire: number; nb_echeances: number; dates: string[] }[];
  };
  tresorerie: {
    solde_comptes_courants: number;
    solde_projete: number;
    point_bas: { date: string; solde: number };
    date_passage_negatif: string | null;
  };
}

export interface BudgetSummaryInput {
  transactions: Transaction[];
  /** Budgets bruts (`baseBudgets`) : montant mensuel, ou annuel pour les enveloppes. */
  baseBudgets: BudgetBase[];
  /** Prévisionnel de trésorerie (récurrences + revenus RAV) jusqu'à `forecast.days` final. */
  forecast: CashflowForecast;
  today?: Date;
}

const INTERNAL_TRANSFER = 'Virement interne';
const round = (n: number) => Math.round(n * 100) / 100;

const isExpenseBudget = (b: BudgetBase): boolean =>
  b.actif !== false && b.isIncome !== true && b.type !== 'revenu' && !isEnvelope(b);

export type MonthBudgetStatus = Pick<
  BudgetSummary,
  | 'mois'
  | 'jours_ecoules'
  | 'jours_du_mois'
  | 'budgets_du_mois'
  | 'total_budgets_mois'
  | 'enveloppes'
>;

const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Consommation des budgets mensuels et état des enveloppes pour `monthKey`
 * (mois passé, en cours ou futur). Le cumul annuel s'arrête à `monthKey`.
 */
export function buildMonthBudgetStatus(
  transactions: Transaction[],
  baseBudgets: BudgetBase[],
  monthKey: string,
  today = new Date(),
): MonthBudgetStatus {
  const [y = NaN, m = NaN] = monthKey.split('-').map(Number);
  const year = String(y);
  const joursDuMois = new Date(y, m, 0).getDate();
  const currentKey = toMonthKey(today);
  const joursEcoules =
    monthKey < currentKey ? joursDuMois : monthKey === currentKey ? today.getDate() : 0;

  // Net dépensé par catégorie (dépenses − remboursements), mois et année jusqu'au mois.
  const spentMonth: Record<string, number> = {};
  const spentYear: Record<string, number> = {};
  for (const tx of transactions) {
    if (tx.categorie === INTERNAL_TRANSFER) continue;
    const m = getAssignedMonthKey(tx);
    if (!m.startsWith(year) || m > monthKey) continue;
    const key = categoryKey(tx.categorie);
    const montant = Number(tx.montant) || 0;
    spentYear[key] = (spentYear[key] ?? 0) - montant;
    if (m === monthKey) spentMonth[key] = (spentMonth[key] ?? 0) - montant;
  }

  const lines: BudgetLineSummary[] = baseBudgets.filter(isExpenseBudget).map((b) => {
    const key = categoryKey(b.categorie);
    const budget = Number(b.montant) || 0;
    const depense = spentMonth[key] ?? 0;
    const depenseAnnee = spentYear[key] ?? 0;
    const projection = joursEcoules > 0 ? (depense / joursEcoules) * joursDuMois : 0;
    const pct = budget > 0 ? (depense / budget) * 100 : 0;
    const statut =
      depense > budget ? 'depasse' : pct >= 80 || projection > budget ? 'a_surveiller' : 'ok';
    return {
      categorie: b.categorie,
      budget_mensuel: round(budget),
      depense_mois: round(depense),
      reste_mois: round(budget - depense),
      pct_consomme: Math.round(pct),
      projection_fin_mois: round(projection),
      statut,
      budget_annee: round(budget * 12),
      depense_annee: round(depenseAnnee),
      reste_annee: round(budget * 12 - depenseAnnee),
    };
  });

  const totalBudget = lines.reduce((s, l) => s + l.budget_mensuel, 0);
  const totalDepense = lines.reduce((s, l) => s + l.depense_mois, 0);

  const enveloppes = baseBudgets
    .filter(isEnvelope)
    .map((b) => computeEnvelope(b, transactions, monthKey))
    .sort((a, b) => a.echeanceKey.localeCompare(b.echeanceKey))
    .map((e) => ({
      categorie: e.categorie,
      montant: round(e.montant),
      depense: round(e.depense),
      reste: round(e.reste),
      echeance: e.echeanceKey,
      provision_mensuelle: round(e.provisionMensuelle),
    }));

  return {
    mois: monthKey,
    jours_ecoules: joursEcoules,
    jours_du_mois: joursDuMois,
    budgets_du_mois: lines.sort((a, b) => b.depense_mois - a.depense_mois),
    total_budgets_mois: {
      budget: round(totalBudget),
      depense: round(totalDepense),
      reste: round(totalBudget - totalDepense),
    },
    enveloppes,
  };
}

export function buildBudgetSummary({
  transactions,
  baseBudgets,
  forecast,
  today = new Date(),
}: BudgetSummaryInput): BudgetSummary {
  // Engagements regroupés par libellé pour rester compact dans le prompt.
  const events = forecast.days.flatMap((d) => d.events);
  const grouped = new Map<string, BudgetSummary['engagements_a_venir']['detail'][number]>();
  for (const ev of events) {
    const g = grouped.get(ev.sourceKey) ?? {
      libelle: ev.label,
      montant_unitaire: round(ev.amount),
      nb_echeances: 0,
      dates: [],
    };
    g.nb_echeances += 1;
    g.dates.push(ev.date);
    grouped.set(ev.sourceKey, g);
  }
  const sumEvents = (type: 'income' | 'expense') =>
    round(events.filter((e) => e.type === type).reduce((s, e) => s + Math.abs(e.amount), 0));

  const first = forecast.days[0];
  const last = forecast.days[forecast.days.length - 1];
  const monthKey = toMonthKey(today);

  return {
    ...buildMonthBudgetStatus(transactions, baseBudgets, monthKey, today),
    engagements_a_venir: {
      jusqu_au: last?.date ?? monthKey,
      total_depenses: sumEvents('expense'),
      total_revenus: sumEvents('income'),
      detail: [...grouped.values()].sort((a, b) => a.montant_unitaire - b.montant_unitaire),
    },
    tresorerie: {
      solde_comptes_courants: round(first?.balance ?? 0),
      solde_projete: round(last?.balance ?? 0),
      point_bas: { date: forecast.lowestPoint.date, solde: round(forecast.lowestPoint.balance) },
      date_passage_negatif: forecast.belowZeroDate,
    },
  };
}
