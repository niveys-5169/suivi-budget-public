import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MonthlySavingsCard } from '../../../public/src/components/analyse/MonthlySavingsCard';
import type {
  MonthlySavingsPosition,
  YearToDateSavings,
} from '../../../public/src/types/banking.types';

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

const yearToDate = (overrides: Partial<YearToDateSavings> = {}): YearToDateSavings => ({
  fromMonth: '2026-01',
  toMonth: '2026-09',
  savingsCapacity: 4_200,
  netSavings: 2_500,
  unavailableMonths: [],
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

  it('en déficit financé par l’épargne, montre la part prise sur la trésorerie', () => {
    render(
      <MonthlySavingsCard
        loading={false}
        position={position({
          operatingBalanceDelta: -262.44,
          savingsDeposits: 0,
          savingsWithdrawals: 1_679.72,
          netSavings: -1_679.72,
          savingsCapacity: -1_942.16,
          unallocatedSurplus: -262.44,
          status: 'DEFICIT',
        })}
      />,
    );

    expect(screen.queryByText("Retrait net d'épargne")).not.toBeInTheDocument();
    const row = screen.getAllByText('Variation de trésorerie')[0]!.parentElement!;
    expect(row).toHaveTextContent(/262,44/);
    expect(row).not.toHaveTextContent(/1\s?679,72/);
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
                suspects: [],
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
                suspects: [
                  {
                    transactionId: 'x',
                    date: '2026-09-20',
                    libelle: 'Assurance',
                    montant: -30,
                    moisAffectation: '2026-10',
                    reasons: ['ASSIGNED_ELSEWHERE', 'MATCHES_GAP'],
                  },
                ],
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText('Écart hors comptes courants')).toBeInTheDocument();
    expect(screen.getByText('Opérations à vérifier')).toBeInTheDocument();
    expect(screen.getByText('Assurance')).toBeInTheDocument();
    expect(
      screen.getByText(/affectée à un autre mois, montant égal à l'écart/),
    ).toBeInTheDocument();
  });

  it('affiche le cumul depuis janvier sous le montant principal', () => {
    render(<MonthlySavingsCard position={position()} loading={false} yearToDate={yearToDate()} />);

    const row = screen.getByText('Cumul depuis janvier').parentElement!;
    expect(row).toHaveTextContent(/4\s?200,00/);
    expect(screen.getByText(/dont .*2\s?500,00.* épargnés/)).toBeInTheDocument();
  });

  it('masque le cumul en janvier, où il égale le mois affiché', () => {
    render(
      <MonthlySavingsCard
        position={position({ month: '2026-01' })}
        loading={false}
        yearToDate={yearToDate({ toMonth: '2026-01' })}
      />,
    );

    expect(screen.queryByText('Cumul depuis janvier')).not.toBeInTheDocument();
  });

  it('liste les mois sans soldes quand le cumul est indisponible', () => {
    render(
      <MonthlySavingsCard
        position={position()}
        loading={false}
        yearToDate={yearToDate({
          savingsCapacity: null,
          unavailableMonths: ['2026-02', '2026-03'],
        })}
      />,
    );

    expect(screen.getByText('Cumul depuis janvier')).toBeInTheDocument();
    expect(screen.getByText('Soldes manquants : 2026-02, 2026-03')).toBeInTheDocument();
    expect(screen.queryByText(/épargnés/)).not.toBeInTheDocument();
  });

  it('n’affiche pas de cumul sans données', () => {
    render(<MonthlySavingsCard position={position()} loading={false} yearToDate={null} />);

    expect(screen.queryByText('Cumul depuis janvier')).not.toBeInTheDocument();
  });
});
