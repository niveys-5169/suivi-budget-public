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
});
