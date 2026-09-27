import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MonthlySavingsCard } from '../../../public/src/components/analyse/MonthlySavingsCard';
import type { MonthlySavingsPosition } from '../../../public/src/types/banking.types';

const position = (overrides: Partial<MonthlySavingsPosition> = {}): MonthlySavingsPosition => ({
  month: '2026-09',
  openingOperatingBalance: 2_000,
  closingOperatingBalance: 2_150,
  operatingBalanceDelta: 150,
  savingsDeposits: 300,
  savingsWithdrawals: 0,
  netSavings: 300,
  savingsCapacity: 450,
  capacityFromTransactions: 450,
  unallocatedSurplus: 150,
  status: 'AVAILABLE_TO_SAVE',
  isCompleteMonth: false,
  dataQuality: {
    calculationStatus: 'COMPLETE',
    missingOpeningBalances: [],
    missingClosingBalances: [],
    unmatchedTransfers: 0,
    uncertainTransfers: 0,
    untrackedTransactionAccounts: [],
    reconciliationDelta: 0,
  },
  breakdown: { entries: [], accounts: [] },
  ...overrides,
});

describe('MonthlySavingsCard', () => {
  it('présente la capacité, l’épargne réalisée et le disponible comme indicateur', () => {
    render(<MonthlySavingsCard position={position()} loading={false} />);

    expect(screen.getByText("Capacité d'épargne à ce jour")).toBeInTheDocument();
    expect(screen.getAllByText('Épargne réalisée')).not.toHaveLength(0);
    expect(screen.getByText('Disponible à épargner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /épargner/i })).not.toBeInTheDocument();
  });

  it('explique les formules dans une infobulle accessible', () => {
    render(<MonthlySavingsCard position={position()} loading={false} />);

    const trigger = screen.getByRole('button', {
      name: "Comprendre le calcul de la capacité d'épargne",
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      "Capacité d'épargne = variation des comptes courants + épargne nette.",
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      "Disponible à épargner = capacité d'épargne − épargne nette.",
    );
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('explique une sur-affectation sans montant disponible négatif', () => {
    render(
      <MonthlySavingsCard
        loading={false}
        position={position({
          savingsCapacity: 300,
          netSavings: 500,
          unallocatedSurplus: -200,
          status: 'OVER_ALLOCATED',
          isCompleteMonth: true,
        })}
      />,
    );

    expect(screen.getByText('Sur-affectation')).toBeInTheDocument();
    expect(screen.queryByText('Disponible à épargner')).not.toBeInTheDocument();
  });

  it('n’affiche aucune fausse précision quand le calcul est indisponible', () => {
    render(
      <MonthlySavingsCard
        loading={false}
        position={position({
          openingOperatingBalance: null,
          operatingBalanceDelta: null,
          savingsCapacity: null,
          unallocatedSurplus: null,
          status: null,
          dataQuality: {
            ...position().dataQuality,
            calculationStatus: 'UNAVAILABLE',
            missingOpeningBalances: ['LCL'],
            reconciliationDelta: null,
          },
        })}
      />,
    );

    expect(screen.getByText('Calcul indisponible')).toBeInTheDocument();
    expect(screen.getByText(/LCL/)).toBeInTheDocument();
  });

  it('détaille les opérations et localise l’écart par compte', () => {
    render(
      <MonthlySavingsCard
        loading={false}
        position={position({
          capacityFromTransactions: 416.58,
          dataQuality: {
            ...position().dataQuality,
            calculationStatus: 'PARTIAL',
            reconciliationDelta: 33.42,
          },
          breakdown: {
            entries: [
              {
                transactionId: 'out',
                date: '2026-09-03',
                libelle: 'Virement Livret A',
                compte: 'Compte courant',
                montant: -300,
                kind: 'SAVINGS_DEPOSIT',
                counterpartAccount: 'Livret A',
              },
              {
                transactionId: 'vague',
                date: '2026-09-05',
                libelle: 'Virement inconnu',
                compte: 'Compte courant',
                montant: -40,
                kind: 'UNCERTAIN',
              },
              {
                transactionId: 'cash',
                date: '2026-09-06',
                libelle: 'Boulangerie',
                compte: 'Liquide',
                montant: -20,
                kind: 'UNTRACKED',
              },
            ],
            accounts: [
              {
                name: 'Compte courant',
                openingBalance: 2_000,
                transactionsTotal: 116.58,
                expectedClosingBalance: 2_116.58,
                closingBalance: 2_150,
                gap: 33.42,
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Virement Livret A')).toBeInTheDocument();
    expect(screen.getByText(/Compte courant → Livret A/)).toBeInTheDocument();
    expect(screen.getByText('Incertain')).toBeInTheDocument();
    expect(screen.getByText('Opérations non prises en compte')).toBeInTheDocument();
    expect(screen.getByText('Boulangerie')).toBeInTheDocument();
    expect(screen.getByText('Solde attendu')).toBeInTheDocument();
    expect(screen.getByText('Écart')).toBeInTheDocument();
    expect(screen.queryByText('Écart hors comptes courants')).not.toBeInTheDocument();
    expect(screen.queryByText('Virements internes neutralisés')).not.toBeInTheDocument();
  });

  it('isole la part de l’écart non portée par les comptes courants', () => {
    render(
      <MonthlySavingsCard
        loading={false}
        position={position({
          dataQuality: { ...position().dataQuality, reconciliationDelta: -50 },
          breakdown: {
            entries: [],
            accounts: [
              {
                name: 'Compte courant',
                openingBalance: 2_000,
                transactionsTotal: 180,
                expectedClosingBalance: 2_180,
                closingBalance: 2_150,
                gap: -30,
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Écart hors comptes courants')).toBeInTheDocument();
  });
});
