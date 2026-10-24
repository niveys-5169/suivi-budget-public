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

  it('ajoute les revenus attendus uniquement pour les salaires et la CAF (ignore les virements internes et épargne)', () => {
    const fixedDate = new Date(2026, 9, 18);
    // Solde actuel 500 €
    // Récurrence virement interne de 10 000 € (DOIT ÊTRE IGNORÉ)
    // Récurrence loyer de 800 €
    const recurrences: Recurrence[] = [
      {
        id: 'rec-virement-interne',
        label: 'Virement compte à compte',
        category: 'Virements internes',
        expectedAmount: 10000, // NE DOIT PAS ÊTRE COMPTÉ
        dayOfMonth: 20,
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

    // Budgets : Salaire Gwen (2 000 €), CAF (150 €), Courses (400 €)
    const budgets: BudgetBase[] = [
      {
        id: 'b-salaire-gwen',
        nom: 'Salaire Gwen',
        categorie: 'Salaire Gwen',
        montant: 2000,
        actif: true,
        type: 'revenu',
      },
      {
        id: 'b-caf',
        nom: 'Allocations CAF',
        categorie: 'CAF',
        montant: 150,
        actif: true,
        type: 'revenu',
      },
      {
        id: 'b-courses',
        nom: 'Courses',
        categorie: 'Courses',
        montant: 400,
        actif: true,
        type: 'mensuel',
      },
    ];

    // checkingTotal (500) + salaires & CAF attendus (2000 + 150 = 2150) = 2650 € liquidités
    // Total engagé = 800 (loyer) + 400 (courses) = 1200 €
    // Safe-to-Spend = 2650 - 1200 = 1450 € (et PAS 11450 € avec les 10 000 de virement !)
    const result = calculateSafeToSpend(500, recurrences, [], budgets, null, fixedDate);

    expect(result.upcomingIncome).toBe(2150);
    expect(result.projectedLiquidity).toBe(2650);
    expect(result.totalCommitted).toBe(1200);
    expect(result.safeToSpend).toBe(1450);
    expect(result.dailyPace).toBeCloseTo(1450 / 14, 2);
  });

  it('ne compte pas le salaire attendu s’il a déjà été crédité ce mois-ci', () => {
    const fixedDate = new Date(2026, 9, 18);
    const budgets: BudgetBase[] = [
      {
        id: 'b-salaire-nico',
        nom: 'Salaire Nico',
        categorie: 'Salaire Nico',
        montant: 2500,
        actif: true,
        type: 'revenu',
      },
    ];

    // Le salaire de 2500 € a déjà été viré le 15 octobre
    const transactions: Transaction[] = [
      {
        id: 'tx-salaire',
        libelle: 'Virement Salaire Entreprise',
        montant: 2500,
        categorie: 'Salaire Nico',
        date: '2026-10-15',
        compte: 'Courant',
        pointe: true,
      },
    ];

    const result = calculateSafeToSpend(3000, [], transactions, budgets, null, fixedDate);

    // Déjà crédité => upcomingIncome = 0 (pas de double comptage avec le solde)
    expect(result.upcomingIncome).toBe(0);
    expect(result.projectedLiquidity).toBe(3000);
    expect(result.safeToSpend).toBe(3000);
  });

  it('normalise les budgets annuels en 1/12e et prend en compte les remboursements de dépenses', () => {
    const fixedDate = new Date(2026, 9, 18);
    const budgets: BudgetBase[] = [
      {
        id: 'b-vacances',
        nom: 'Vacances',
        categorie: 'Vacances',
        montant: 2400, // Budget annuel de 2400 € => 200 € / mois
        actif: true,
        type: 'annuel',
      },
      {
        id: 'b-sante',
        nom: 'Santé',
        categorie: 'Santé',
        montant: 100,
        actif: true,
        type: 'mensuel',
      },
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx-medecin',
        libelle: 'Consultation',
        montant: -60,
        categorie: 'Santé',
        date: '2026-10-05',
        compte: 'Courant',
        pointe: true,
      },
      {
        id: 'tx-remboursement',
        libelle: 'Remboursement CPAM',
        montant: 40, // Remboursement de 40 € => dépense nette Santé = 20 €
        categorie: 'Santé',
        date: '2026-10-10',
        compte: 'Courant',
        pointe: true,
      },
    ];

    // Vacances : budget mensuel 2400/12 = 200, dépensé 0 => restant 200
    // Santé : budget 100, dépensé net 20 => restant 80
    // Total restant = 280 €
    const result = calculateSafeToSpend(2000, [], transactions, budgets, null, fixedDate);

    expect(result.remainingBudgets).toBe(280);
    expect(result.safeToSpend).toBe(1720); // 2000 - 280
  });
});
