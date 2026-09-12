import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AnalyseScreen } from '../../../public/src/mobile/screens/AnalyseScreen';
import { AppStateProvider } from '../../../public/src/context/AppStateContext';
import * as useTransactionsModule from '../../../public/src/hooks/useTransactions';
import * as globalDataModule from '../../../public/src/context/GlobalDataContext';

// Mock dependencies
vi.mock('../../../public/src/hooks/useTransactions', () => ({
  useTransactions: vi.fn(),
}));

vi.mock('../../../public/src/context/GlobalDataContext', () => ({
  useGlobalData: vi.fn(),
}));

// `useFormOptions` (catégories / comptes de la modale d'édition) s'appuie sur
// ces deux hooks, qui exigent leurs providers.
vi.mock('../../../public/src/hooks/useBudget', () => ({
  useBudget: () => ({ budgets: [], getBudgetCategoryCandidates: () => ['Loyer', 'Netflix'] }),
}));

vi.mock('../../../public/src/hooks/useBalances', () => ({
  useBalances: () => ({ balances: [{ compte: 'BforBank' }] }),
}));

const MONTH = '2026-05';

/**
 * Régression : le drill-down de catégorie appelle `onTransactionClick?.(tx)`.
 * Tant que `AnalyseScreen` ne passait pas la prop et ne montait pas
 * `TransactionFormModal`, taper une opération depuis Analyses était un no-op
 * silencieux — « Audit Flux » y restait inaccessible, alors que l'écran
 * Budgets mobile et l'Analyse desktop l'ouvraient bien.
 */
const drillDownTransactions = [
  {
    id: 'tx-1',
    libelle: 'Pharmacie Du Val D’armor',
    categorie: 'Santé',
    montant: -5.95,
    date: '2026-05-24',
    moisAffectation: MONTH,
    compte: 'BforBank',
    pointe: false,
  },
];

function renderDrillDownScreen() {
  localStorage.setItem('app_month_key', MONTH);

  vi.spyOn(useTransactionsModule, 'useTransactions').mockReturnValue({
    transactions: drillDownTransactions,
    filteredTransactions: drillDownTransactions,
    loading: false,
    togglePointe: vi.fn(),
    saveTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  } as any);

  vi.spyOn(globalDataModule, 'useGlobalData').mockReturnValue({ recurrences: [] } as any);

  return render(
    <AppStateProvider>
      <AnalyseScreen />
    </AppStateProvider>,
  );
}

test('AnalyseScreen — taper une opération du drill-down ouvre « Audit Flux »', async () => {
  renderDrillDownScreen();

  fireEvent.click(screen.getByText('Santé'));

  fireEvent.click(await screen.findByText('Pharmacie Du Val D’armor'));

  expect(await screen.findByRole('dialog', { name: /Audit Flux/i })).toBeInTheDocument();
  // La modale est alimentée par l'opération tapée, pas vide.
  expect(screen.getByDisplayValue('Pharmacie Du Val D’armor')).toBeInTheDocument();
});

test('AnalyseScreen — pas de modale tant qu’aucune opération n’est sélectionnée', async () => {
  renderDrillDownScreen();

  fireEvent.click(screen.getByText('Santé'));

  await screen.findByText('Pharmacie Du Val D’armor');
  expect(screen.queryByRole('dialog', { name: /Audit Flux/i })).not.toBeInTheDocument();
});
