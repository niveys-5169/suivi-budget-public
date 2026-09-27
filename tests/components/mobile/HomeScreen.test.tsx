import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { HomeScreen } from '../../../public/src/mobile/screens/HomeScreen';

const balances = vi.hoisted(() => [
  {
    id: 'BforBank',
    compte: 'BforBank',
    current_balance: 515.98,
    status: 'pending_review',
    ecart: 208.38,
  },
  { id: 'LCL', compte: 'LCL', current_balance: 2196.35, status: 'reconciled', ecart: 0 },
]);

const transactions = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('../../../public/src/hooks/useBalances', () => ({
  useBalances: () => ({
    checkingBalances: balances,
    checkingTotal: 2712.33,
  }),
}));
vi.mock('../../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: transactions.current,
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    updateFilters: vi.fn(),
    togglePointe: vi.fn(),
  }),
}));
vi.mock('../../../public/src/hooks/useFormOptions', () => ({
  useFormOptions: () => ({ categories: [], accounts: [] }),
}));
// Cartes et modales annexes : hors sujet ici, et chacune exige ses providers.
vi.mock('../../../public/src/components/dashboard/v2/AurumCashflowCard', () => ({
  AurumCashflowCard: () => null,
}));
vi.mock('../../../public/src/mobile/components/MSettingsModal', () => ({
  MSettingsModal: () => null,
}));
vi.mock('../../../public/src/components/TransactionFormModal', () => ({
  TransactionFormModal: () => null,
}));
vi.mock('../../../public/src/components/dashboard/v2/AurumPointageModal', () => ({
  AurumPointageModal: () => null,
}));

beforeEach(() => {
  transactions.current = [];
});

/**
 * Régression : un solde BforBank régressé par un vieux mail Linxo était passé
 * en pending_review (écart 208,38 €), mais l'accueil mobile n'affichait que le
 * montant — l'alerte n'existait que dans BalanceCard, côté desktop.
 */
test("signale l'écart d'audit d'un solde à revoir, pas celui d'un solde réconcilié", () => {
  render(
    <MemoryRouter>
      <HomeScreen />
    </MemoryRouter>,
  );

  const badges = screen.getAllByText(/Écart/);
  expect(badges).toHaveLength(1);
  // FormattedNumber est mocké globalement (tests/setup.tsx) : valeur brute.
  expect(badges[0]?.textContent).toBe('Écart 208.38');
});

/**
 * Régression : le « Solde bas » du mail du 25/09 n'était pas lu, mais ses
 * opérations l'étaient. Le solde LCL (réconcilié, mail du 24/09) devient
 * « non à jour » dès qu'une opération d'un mail postérieur arrive.
 */
test('signale un solde non à jour quand des opérations sont arrivées après son mail', () => {
  const lcl = balances[1] as Record<string, unknown>;
  lcl.emailDate = { toDate: () => new Date('2026-09-24T04:28:44Z') };
  transactions.current = [
    { compte: 'LCL', montant: -68.38, emailDate: new Date('2026-09-25T04:23:45Z'), pointe: true },
    { compte: 'LCL', montant: -140, emailDate: new Date('2026-09-25T04:23:45Z'), pointe: true },
  ];
  try {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Non à jour/).textContent).toBe('Non à jour -208.38');
  } finally {
    delete lcl.emailDate;
  }
});
