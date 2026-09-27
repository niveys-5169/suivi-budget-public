import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MBudgetGrid } from '../MBudgetGrid';
import type { CategoryDetail } from '../../../components/budgets-v2/bankin/BankinBudgetsContainer';

const cat = (nom: string): CategoryDetail => ({
  id: nom,
  nom,
  depense: 10,
  montant: 100,
  isIncome: false,
  transactions: [],
  sparklineData: [],
});

const renderGrid = (isManualSort: boolean) =>
  render(
    <IntlProvider locale="fr">
      <MBudgetGrid
        title="Dépenses"
        color="#fff"
        categories={[cat('Loisirs'), cat('Courses')]}
        onCategoryClick={() => {}}
        isManualSort={isManualSort}
        onReorder={() => {}}
      />
    </IntlProvider>,
  );

describe('MBudgetGrid', () => {
  it('affiche une poignée de glisser par catégorie en tri manuel', () => {
    renderGrid(true);
    expect(screen.getByRole('button', { name: /réordonner Loisirs/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /réordonner Courses/ })).toBeInTheDocument();
  });

  it("n'affiche pas de poignée hors tri manuel", () => {
    renderGrid(false);
    expect(screen.queryByRole('button', { name: /réordonner/ })).not.toBeInTheDocument();
    expect(screen.getByText('Loisirs')).toBeInTheDocument();
  });
});
