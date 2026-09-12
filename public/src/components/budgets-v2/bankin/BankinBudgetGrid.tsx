import React from 'react';
import { BankinBudgetCard } from './BankinBudgetCard';

import { CategoryDetail } from './BankinBudgetsContainer';

interface Props {
  categories: CategoryDetail[];
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  expectedPct?: number;
}

export const BankinBudgetGrid: React.FC<Props> = ({
  categories,
  onCategoryClick,
  onToggleSens,
  expectedPct,
}) => {
  return (
    <div className="flex flex-col gap-2">
      {categories.map((cat) => (
        <BankinBudgetCard
          key={cat.id}
          name={cat.nom || cat.id}
          spent={cat.depense}
          budget={cat.montant}
          onClick={() => onCategoryClick(cat.id)}
          isIncome={cat.isIncome}
          storedIsIncome={cat.storedIsIncome}
          onToggleSens={onToggleSens ? () => onToggleSens(cat.id, cat.storedIsIncome) : undefined}
          expectedPct={expectedPct}
        />
      ))}
    </div>
  );
};
