import { describe, expect, it } from 'vitest';
import { calculateMonthlySavingsPosition } from '../../public/src/utils/monthlySavings';
import type { MonthlySavingsInput, Transaction } from '../../public/src/types/banking.types';

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'tx',
  date: '2026-09-15',
  libelle: 'Opération',
  montant: 0,
  compte: 'Compte courant',
  pointe: true,
  ...overrides,
});

const input = (overrides: Partial<MonthlySavingsInput> = {}): MonthlySavingsInput => ({
  month: '2026-09',
  isCompleteMonth: true,
  accounts: [
    {
      id: 'checking',
      name: 'Compte courant',
      role: 'OPERATING',
      openingBalance: 2_000,
      closingBalance: 2_150,
    },
    {
      id: 'savings',
      name: 'Livret A',
      role: 'SAVINGS',
      openingBalance: null,
      closingBalance: null,
    },
  ],
  transactions: [
    transaction({ id: 'income', libelle: 'Salaire', montant: 450, categorie: 'Salaire' }),
    transaction({
      id: 'deposit',
      libelle: 'Virement Livret A',
      montant: -300,
      categorie: 'Épargne',
    }),
  ],
  ...overrides,
});

describe('calculateMonthlySavingsPosition', () => {
  it("préserve la capacité générée lorsque l'excédent est partiellement affecté", () => {
    const result = calculateMonthlySavingsPosition(input());

    expect(result).toMatchObject({
      operatingBalanceDelta: 150,
      savingsDeposits: 300,
      savingsWithdrawals: 0,
      netSavings: 300,
      savingsCapacity: 450,
      unallocatedSurplus: 150,
      status: 'AVAILABLE_TO_SAVE',
    });
  });

  it('calcule un mois sans mouvement d’épargne', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_500,
          },
        ],
        transactions: [transaction({ montant: 500, categorie: 'Salaire' })],
      }),
    );
    expect(result).toMatchObject({
      operatingBalanceDelta: 500,
      netSavings: 0,
      savingsCapacity: 500,
      unallocatedSurplus: 500,
      status: 'AVAILABLE_TO_SAVE',
    });
  });

  it('passe à entièrement affecté sans effacer la capacité', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_000,
          },
        ],
        transactions: [
          transaction({ id: 'income', montant: 500, categorie: 'Salaire' }),
          transaction({ id: 'deposit', montant: -500, categorie: 'Epargne' }),
        ],
      }),
    );
    expect(result).toMatchObject({
      netSavings: 500,
      savingsCapacity: 500,
      unallocatedSurplus: 0,
      status: 'FULLY_ALLOCATED',
    });
  });

  it('détecte un mois déficitaire financé par un retrait', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_100,
          },
        ],
        transactions: [
          transaction({ id: 'expense', montant: -200, categorie: 'Courses' }),
          transaction({ id: 'withdrawal', montant: 300, categorie: 'Retrait Épargne' }),
        ],
      }),
    );
    expect(result).toMatchObject({
      operatingBalanceDelta: 100,
      savingsWithdrawals: 300,
      netSavings: -300,
      savingsCapacity: -200,
      status: 'DEFICIT',
    });
  });

  it('détecte une sur-affectation financée par la trésorerie antérieure', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 3_000,
            closingBalance: 2_800,
          },
        ],
        transactions: [
          transaction({ id: 'income', montant: 300, categorie: 'Salaire' }),
          transaction({ id: 'deposit', montant: -500, categorie: 'Épargne' }),
        ],
      }),
    );
    expect(result).toMatchObject({
      savingsCapacity: 300,
      netSavings: 500,
      unallocatedSurplus: -200,
      status: 'OVER_ALLOCATED',
    });
  });

  it('neutralise un virement entre deux comptes courants', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'a',
            name: 'Courant A',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 1_000,
          },
          {
            id: 'b',
            name: 'Courant B',
            role: 'OPERATING',
            openingBalance: 500,
            closingBalance: 1_500,
          },
        ],
        transactions: [
          transaction({ id: 'a-out', compte: 'Courant A', montant: -1_000, libelle: 'Virement' }),
          transaction({ id: 'b-in', compte: 'Courant B', montant: 1_000, libelle: 'Virement' }),
        ],
      }),
    );
    expect(result).toMatchObject({ netSavings: 0, savingsCapacity: 0, status: 'BALANCED' });
  });

  it('neutralise un virement entre deux livrets', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_000,
          },
          {
            id: 'a',
            name: 'Livret A',
            role: 'SAVINGS',
            openingBalance: null,
            closingBalance: null,
          },
          {
            id: 'b',
            name: 'LDDS',
            role: 'SAVINGS',
            openingBalance: null,
            closingBalance: null,
          },
        ],
        transactions: [
          transaction({ id: 'a-out', compte: 'Livret A', montant: -2_000, libelle: 'Virement' }),
          transaction({ id: 'b-in', compte: 'LDDS', montant: 2_000, libelle: 'Virement' }),
        ],
      }),
    );
    expect(result).toMatchObject({ netSavings: 0, savingsCapacity: 0 });
  });

  it('ne compte qu’une fois les deux jambes d’un versement d’épargne', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_000,
          },
          {
            id: 'savings',
            name: 'Livret A',
            role: 'SAVINGS',
            openingBalance: null,
            closingBalance: null,
          },
        ],
        transactions: [
          transaction({ id: 'out', compte: 'Compte courant', montant: -500, libelle: 'Virement' }),
          transaction({ id: 'in', compte: 'Livret A', montant: 500, libelle: 'Virement' }),
        ],
      }),
    );
    expect(result.savingsDeposits).toBe(500);
  });

  it('additionne les versements et retraits distincts du mois', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        transactions: [
          transaction({ id: 'deposit', montant: -700, categorie: 'Épargne' }),
          transaction({ id: 'withdrawal', montant: 250, categorie: 'Retrait Epargne' }),
        ],
      }),
    );
    expect(result).toMatchObject({
      savingsDeposits: 700,
      savingsWithdrawals: 250,
      netSavings: 450,
    });
  });

  it('considère une capacité proche de zéro comme équilibrée', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 1_500,
          },
        ],
        transactions: [transaction({ montant: -500, categorie: 'Épargne' })],
      }),
    );
    expect(result).toMatchObject({ savingsCapacity: 0, status: 'BALANCED' });
  });

  it('agrège plusieurs comptes avant d’interpréter la variation', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'a',
            name: 'Courant A',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 1_000,
          },
          {
            id: 'b',
            name: 'Courant B',
            role: 'OPERATING',
            openingBalance: 500,
            closingBalance: 1_600,
          },
        ],
        transactions: [transaction({ compte: 'Courant B', montant: 100, categorie: 'Salaire' })],
      }),
    );
    expect(result).toMatchObject({
      openingOperatingBalance: 2_500,
      closingOperatingBalance: 2_600,
      operatingBalanceDelta: 100,
    });
  });

  it('rend le calcul indisponible si un solde d’ouverture manque', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: null,
            closingBalance: 2_000,
          },
        ],
      }),
    );
    expect(result.savingsCapacity).toBeNull();
    expect(result.status).toBeNull();
    expect(result.dataQuality).toMatchObject({
      calculationStatus: 'UNAVAILABLE',
      missingOpeningBalances: ['Compte courant'],
    });
  });

  it('ignore une ligne dupliquée portant le même identifiant', () => {
    const duplicate = transaction({ id: 'same', montant: -300, categorie: 'Épargne' });
    const result = calculateMonthlySavingsPosition(
      input({ transactions: [duplicate, { ...duplicate }] }),
    );
    expect(result.savingsDeposits).toBe(300);
  });

  it('signale plusieurs contreparties possibles sans les apparier arbitrairement', () => {
    const result = calculateMonthlySavingsPosition(
      input({
        accounts: [
          {
            id: 'checking',
            name: 'Compte courant',
            role: 'OPERATING',
            openingBalance: 2_000,
            closingBalance: 2_000,
          },
          {
            id: 'a',
            name: 'Livret A',
            role: 'SAVINGS',
            openingBalance: null,
            closingBalance: null,
          },
          {
            id: 'b',
            name: 'LDDS',
            role: 'SAVINGS',
            openingBalance: null,
            closingBalance: null,
          },
        ],
        transactions: [
          transaction({ id: 'out', compte: 'Compte courant', montant: -500, libelle: 'Virement' }),
          transaction({ id: 'in-a', compte: 'Livret A', montant: 500, libelle: 'Virement' }),
          transaction({ id: 'in-b', compte: 'LDDS', montant: 500, libelle: 'Virement' }),
        ],
      }),
    );
    expect(result.savingsDeposits).toBe(0);
    expect(result.dataQuality.calculationStatus).toBe('PARTIAL');
    expect(result.dataQuality.uncertainTransfers).toBe(1);
  });

  it('signale un compte transactionnel non suivi, dont Liquide', () => {
    const result = calculateMonthlySavingsPosition(
      input({ transactions: [transaction({ compte: 'Liquide', montant: -20 })] }),
    );
    expect(result.dataQuality).toMatchObject({
      calculationStatus: 'PARTIAL',
      untrackedTransactionAccounts: ['Liquide'],
    });
  });

  it('conserve le caractère provisoire du mois courant', () => {
    const result = calculateMonthlySavingsPosition(input({ isCompleteMonth: false }));
    expect(result.isCompleteMonth).toBe(false);
  });
});
