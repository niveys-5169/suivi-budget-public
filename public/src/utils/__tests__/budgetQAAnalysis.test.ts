import { describe, it, expect } from 'vitest';
import { buildBudgetSummary } from '../budgetQAAnalysis';
import { computeCashflowForecast } from '../computeCashflowForecast';
import type { BudgetBase, Transaction } from '../../types/banking.types';

const today = new Date(2026, 8, 15); // 15/09/2026

const tx = (date: string, montant: number, categorie: string): Transaction =>
  ({
    id: `${date}-${montant}-${categorie}`,
    date,
    montant,
    categorie,
    libelle: 'x',
  }) as Transaction;

const budget = (categorie: string, montant: number, extra: Partial<BudgetBase> = {}): BudgetBase =>
  ({
    id: categorie,
    categorie,
    nom: categorie,
    montant,
    actif: true,
    type: 'mensuel',
    ...extra,
  }) as BudgetBase;

const forecast = computeCashflowForecast({
  startBalance: 1000,
  startDate: today,
  horizonDays: 107, // → 31/12
  recurringExpenses: [{ key: 'loyer', label: 'Loyer', avgAmount: 800, dayOfMonth: 5 }],
  recurringIncomes: [{ key: 'sal', label: 'Salaire', amount: 2000, dayOfMonth: 28 }],
  safetyThreshold: 0,
});

describe('buildBudgetSummary', () => {
  const summary = buildBudgetSummary({
    transactions: [
      tx('2026-09-03', -300, 'Courses'),
      tx('2026-09-10', 20, 'Courses'), // remboursement
      tx('2026-08-10', -400, 'Courses'),
      tx('2026-09-12', -500, 'Virement interne'),
      tx('2026-07-01', -900, 'Vacances'),
    ],
    baseBudgets: [
      budget('Courses', 400),
      budget('Vacances', 1500, { type: 'annuel', moisAttendus: [8] }),
      budget('Salaire', 2000, { type: 'revenu' }),
    ],
    forecast,
    today,
  });

  it('calcule la consommation du mois et de l’année par budget', () => {
    expect(summary.budgets_du_mois).toHaveLength(1);
    const courses = summary.budgets_du_mois[0]!;
    expect(courses).toMatchObject({
      categorie: 'Courses',
      budget_mensuel: 400,
      depense_mois: 280,
      reste_mois: 120,
      pct_consomme: 70,
      projection_fin_mois: 560,
      statut: 'a_surveiller',
      budget_annee: 4800,
      depense_annee: 680,
    });
  });

  it('suit les enveloppes annuelles sur leur cycle', () => {
    // Échéance en août : en septembre 2026 le cycle est sept. 2026 → août 2027.
    expect(summary.enveloppes).toEqual([
      expect.objectContaining({
        categorie: 'Vacances',
        depense: 0,
        reste: 1500,
        echeance: '2027-08',
      }),
    ]);
  });

  it('résume les engagements à venir et la trésorerie', () => {
    const { engagements_a_venir: eng, tresorerie } = summary;
    expect(eng.jusqu_au).toBe('2026-12-31');
    expect(eng.total_depenses).toBe(2400); // loyer oct., nov., déc.
    expect(eng.total_revenus).toBe(8000); // salaire sept. → déc.
    expect(tresorerie.solde_comptes_courants).toBe(1000);
    expect(tresorerie.solde_projete).toBe(1000 - 2400 + 8000);
    expect(tresorerie.date_passage_negatif).toBeNull();
  });
});
