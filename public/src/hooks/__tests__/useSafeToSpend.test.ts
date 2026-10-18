import { describe, it, expect } from 'vitest';
import { calculateSafeToSpend } from '../useSafeToSpend';
import type { Recurrence, Transaction, BudgetBase } from '../../types/banking.types';
import { Timestamp } from 'firebase/firestore';

const mockTimestamp = Timestamp.fromDate(new Date(2026, 0, 1));

describe('calculateSafeToSpend', () => {
  it('calcule correctement le reste à vivre sans récurrences ni budgets', () => {
    const fixedDate = new Date(2026, 9, 18); // 18 Octobre 2026 (mois de 31 jours)
    const result = calculateSafeToSpend(3000, [], [], [], null, fixedDate);

    // Du 18 au 31 inclus = 31 - 18 + 1 = 14 jours
    expect(result.daysRemainingInMonth).toBe(14);
    expect(result.upcomingFixedCharges).toBe(0);
    expect(result.remainingBudgets).toBe(0);
    expect(result.totalCommitted).toBe(0);
    expect(result.safeToSpend).toBe(3000);
    expect(result.dailyPace).toBeCloseTo(3000 / 14, 2);
  });

  it('déduit les charges récurrentes attendues non encore décaissées', () => {
    const fixedDate = new Date(2026, 9, 18);
    const recurrences: Recurrence[] = [
      {
        id: 'rec-loyer',
        label: 'Loyer',
        category: 'Logement',
        expectedAmount: -800,
        dayOfMonth: 25, // Attendue le 25 Octobre (après le 18)
        active: true,
        createdAt: mockTimestamp,
      },
      {
        id: 'rec-salaire',
        label: 'Salaire',
        category: 'Revenus',
        expectedAmount: 2500, // Entrée (non comptée dans les charges)
        dayOfMonth: 28,
        active: true,
        createdAt: mockTimestamp,
      },
    ];

    const result = calculateSafeToSpend(2000, recurrences, [], [], null, fixedDate);

    expect(result.upcomingIncome).toBe(2500);
    expect(result.projectedLiquidity).toBe(4500);
    expect(result.upcomingFixedCharges).toBe(800);
    expect(result.remainingBudgets).toBe(0);
    expect(result.safeToSpend).toBe(3700); // (2000 + 2500) - 800
    expect(result.dailyPace).toBeCloseTo(3700 / 14, 2);
  });

  it('déduit le reste à dépenser des budgets variables actifs', () => {
    const fixedDate = new Date(2026, 9, 18);
    const budgets: BudgetBase[] = [
      {
        id: 'b-courses',
        nom: 'Courses',
        categorie: 'Alimentation',
        montant: 500,
        actif: true,
        type: 'mensuel',
      },
      {
        id: 'b-carburant',
        nom: 'Carburant',
        categorie: 'Transport',
        montant: 150,
        actif: true,
        type: 'mensuel',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        libelle: 'Supermarché',
        montant: -200,
        categorie: 'Alimentation',
        date: '2026-10-05',
        compte: 'Courant',
        pointe: true,
      },
    ];

    // Alimentation : 500 budget - 200 dépensé = 300 restant
    // Transport : 150 budget - 0 dépensé = 150 restant
    // Total budgets restants = 450
    const result = calculateSafeToSpend(2000, [], transactions, budgets, null, fixedDate);

    expect(result.upcomingFixedCharges).toBe(0);
    expect(result.remainingBudgets).toBe(450);
    expect(result.safeToSpend).toBe(1550); // 2000 - 450
    expect(result.dailyPace).toBeCloseTo(1550 / 14, 2);
  });

  it('neutralise le double comptage si une catégorie a une récurrence ET un budget', () => {
    const fixedDate = new Date(2026, 9, 18);
    const recurrences: Recurrence[] = [
      {
        id: 'rec-edf',
        label: 'EDF',
        category: 'Énergie',
        expectedAmount: -100,
        dayOfMonth: 25,
        active: true,
        createdAt: mockTimestamp,
      },
    ];

    const budgets: BudgetBase[] = [
      {
        id: 'b-energie',
        nom: 'Énergie',
        categorie: 'Énergie',
        montant: 120, // Budget de 120 € (dont 100 € de récurrence EDF)
        actif: true,
        type: 'mensuel',
      },
    ];

    // upcomingFixedCharges = 100
    // Budget Énergie brut = 120 - 0 dépensé = 120
    // Mais 100 sont déjà comptés dans les charges récurrentes !
    // Donc remainingBudgets pour Énergie = 120 - 100 = 20
    // Total engagé = 100 + 20 = 120 (et non pas 220 !)
    const result = calculateSafeToSpend(1000, recurrences, [], budgets, null, fixedDate);

    expect(result.upcomingFixedCharges).toBe(100);
    expect(result.remainingBudgets).toBe(20);
    expect(result.totalCommitted).toBe(120);
    expect(result.safeToSpend).toBe(880); // 1000 - 120
  });

  it('ne compte pas de budget résiduel si la catégorie est dépassée', () => {
    const fixedDate = new Date(2026, 9, 18);
    const budgets: BudgetBase[] = [
      {
        id: 'b-loisirs',
        nom: 'Loisirs',
        categorie: 'Loisirs',
        montant: 100,
        actif: true,
        type: 'mensuel',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-depassement',
        libelle: 'Concert',
        montant: -150, // 150 dépensé > 100 de budget
        categorie: 'Loisirs',
        date: '2026-10-10',
        compte: 'Courant',
        pointe: true,
      },
    ];

    const result = calculateSafeToSpend(1000, [], transactions, budgets, null, fixedDate);

    expect(result.remainingBudgets).toBe(0);
    expect(result.safeToSpend).toBe(1000);
  });

  it('ajoute les revenus attendus (salaires / récurrences positives) pour éviter de tomber à 0', () => {
    const fixedDate = new Date(2026, 9, 18);
    // Solde actuel faible (500 €), mais salaire de 2 500 € attendu le 28
    const recurrences: Recurrence[] = [
      {
        id: 'rec-salaire',
        label: 'Salaire',
        category: 'Revenus',
        expectedAmount: 2500,
        dayOfMonth: 28,
        active: true,
        createdAt: mockTimestamp,
      },
      {
        id: 'rec-loyer',
        label: 'Loyer',
        category: 'Logement',
        expectedAmount: -800,
        dayOfMonth: 25,
        active: true,
        createdAt: mockTimestamp,
      },
    ];

    const budgets: BudgetBase[] = [
      {
        id: 'b-courses',
        nom: 'Courses',
        categorie: 'Courses',
        montant: 400,
        actif: true,
        type: 'mensuel',
      },
    ];

    // checkingTotal (500) + salaire attendu (2500) = 3000 € liquidités
    // Total engagé = 800 (loyer) + 400 (courses) = 1200 €
    // Safe-to-Spend = 3000 - 1200 = 1800 € (et non 0 !)
    const result = calculateSafeToSpend(500, recurrences, [], budgets, null, fixedDate);

    expect(result.upcomingIncome).toBe(2500);
    expect(result.projectedLiquidity).toBe(3000);
    expect(result.totalCommitted).toBe(1200);
    expect(result.safeToSpend).toBe(1800);
    expect(result.dailyPace).toBeCloseTo(1800 / 14, 2);
  });
});
