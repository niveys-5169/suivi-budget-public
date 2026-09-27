import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BalanceCard } from '../../public/src/components/BalanceCard';
import type { AccountBalance } from '../../public/src/types/balances';

// Solde BforBank du 24/09 : contrôle d'import OK (524,86 − 8,88 = 515,98).
const balance = {
  id: 'BforBank',
  compte: 'BforBank',
  current_balance: 515.98,
  status: 'reconciled',
  ecart: 0,
  previousSolde: 524.86,
  linxoDelta: -8.88,
  computedSolde: 515.98,
} as unknown as AccountBalance;

/**
 * Régression : le « Solde bas » du mail du 25/09 n'était pas lu, mais ses deux
 * opérations (−208,38 €) l'étaient. La carte restait « OK » : ses chiffres ne
 * décrivent que le dernier solde écrit.
 */
test('signale un solde non à jour quand des opérations sont arrivées après son mail', () => {
  render(<BalanceCard balance={balance} mouvementsDepuis={{ total: -208.38, count: 2 }} />);

  expect(screen.getByText('NON À JOUR')).toBeInTheDocument();
  expect(screen.queryByText('OK')).not.toBeInTheDocument();
  expect(screen.getByText(/Depuis ce solde \(2 opérations\)/)).toBeInTheDocument();
  expect(screen.getByText(/-208,38/)).toBeInTheDocument();
});

test('reste OK sans opération postérieure au mail du solde', () => {
  render(<BalanceCard balance={balance} mouvementsDepuis={{ total: 0, count: 0 }} />);

  expect(screen.getByText('OK')).toBeInTheDocument();
  expect(screen.getByText(/Depuis ce solde \(0 opération\)/)).toBeInTheDocument();
});
