import type { BudgetBase, Transaction } from '../../types/banking.types';
import { computeCashflowForecast } from '../../utils/computeCashflowForecast';
import type { FinanceToolsContext } from '../../utils/financeTools';

/**
 * Jeu de données fictif et figé pour évaluer l'assistant IA : 16 mois
 * d'opérations régulières (juin 2025 → 27 septembre 2026) + quelques
 * dépenses exceptionnelles. Les réponses attendues des cas d'évaluation
 * sont calculées à la main à partir de ces données.
 */

export const FIXTURE_TODAY = new Date(2026, 8, 27, 12); // 27/09/2026 midi
export const FIXTURE_CHECKING_BALANCE = 1800;

const pad = (n: number) => String(n).padStart(2, '0');
let seq = 0;
const tx = (date: string, montant: number, categorie: string, libelle: string): Transaction => ({
  id: `fx-${++seq}`,
  date,
  montant,
  categorie,
  libelle,
  compte: 'Compte courant',
  pointe: true,
});

/** Opérations mensuelles : [jour, montant, catégorie, libellé]. */
const MONTHLY: [number, number, string, string][] = [
  [1, -300, 'Épargne', 'VIR LIVRET A'],
  [3, -120, 'Courses', 'CARREFOUR'],
  [5, -950, 'Logement', 'LOYER AGENCE'],
  [8, -13.49, 'Abonnements', 'NETFLIX'],
  [10, -45, 'Restaurants', 'PIZZERIA NAPOLI'],
  [12, -95, 'Courses', 'LIDL'],
  [15, -35, 'Shopping', 'AMAZON EU SARL'],
  [20, -140, 'Courses', 'CARREFOUR'],
  [22, -60, 'Restaurants', 'SUSHI BAR'],
  [28, 3200, 'Salaire', 'VIREMENT SALAIRE'],
  [29, -500, 'Virement interne', 'VIR COMPTE JOINT'],
];

const EXTRAS: Transaction[] = [
  tx('2025-12-20', -400, 'Cadeaux', 'FNAC'),
  tx('2026-03-14', -200, 'Restaurants', 'LE GRAND RESTAURANT'),
  tx('2026-07-18', -250, 'Shopping', 'AMAZON EU SARL'),
  tx('2026-08-02', -1200, 'Vacances', 'AIRBNB'),
  tx('2026-09-24', -80, 'Restaurants', 'BRASSERIE DU PORT'),
];

function buildTransactions(): Transaction[] {
  const todayKey = '2026-09-27';
  const list: Transaction[] = [];
  for (let d = new Date(2025, 5, 1); d <= FIXTURE_TODAY; d.setMonth(d.getMonth() + 1)) {
    const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    for (const [day, montant, categorie, libelle] of MONTHLY) {
      const date = `${month}-${pad(day)}`;
      if (date <= todayKey) list.push(tx(date, montant, categorie, libelle));
    }
  }
  return [...list, ...EXTRAS];
}

const budget = (
  categorie: string,
  montant: number,
  extra: Partial<BudgetBase> = {},
): BudgetBase => ({
  id: categorie,
  categorie,
  nom: categorie,
  montant,
  actif: true,
  type: 'mensuel',
  ...extra,
});

export const FIXTURE_TRANSACTIONS = buildTransactions();

export const FIXTURE_BUDGETS: BudgetBase[] = [
  budget('Courses', 400),
  budget('Restaurants', 150),
  budget('Shopping', 100),
  budget('Abonnements', 20),
  budget('Vacances', 1500, { type: 'annuel', moisAttendus: [8] }),
  budget('Salaire', 3200, { type: 'revenu', isIncome: true }),
];

export const FIXTURE_FORECAST = computeCashflowForecast({
  startBalance: FIXTURE_CHECKING_BALANCE,
  startDate: FIXTURE_TODAY,
  horizonDays: 95, // → 31/12/2026
  recurringExpenses: [
    { key: 'loyer', label: 'LOYER AGENCE', avgAmount: 950, dayOfMonth: 5 },
    { key: 'netflix', label: 'NETFLIX', avgAmount: 13.49, dayOfMonth: 8 },
  ],
  recurringIncomes: [{ key: 'salaire', label: 'VIREMENT SALAIRE', amount: 3200, dayOfMonth: 28 }],
  safetyThreshold: 0,
});

export const FIXTURE_CONTEXT: FinanceToolsContext = {
  transactions: FIXTURE_TRANSACTIONS,
  baseBudgets: FIXTURE_BUDGETS,
  forecast: FIXTURE_FORECAST,
  today: FIXTURE_TODAY,
};
