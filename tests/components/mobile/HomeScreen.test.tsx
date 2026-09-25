import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
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

vi.mock('../../../public/src/hooks/useBalances', () => ({
  useBalances: () => ({
    checkingBalances: balances,
    checkingTotal: 2712.33,
  }),
}));
vi.mock('../../../public/src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [],
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
