import React from 'react';
import { MBudgetMiniCard } from './MBudgetMiniCard';
import type { CategoryDetail } from '../../components/budgets-v2/bankin/BankinBudgetsContainer';

interface MBudgetGridProps {
  title: string;
  color: string;
  categories: CategoryDetail[];
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  expectedPct?: number;
}

export const MBudgetGrid: React.FC<MBudgetGridProps> = ({
  title,
  color,
  categories,
  onCategoryClick,
  onToggleSens,
  expectedPct,
}) => {
  if (categories.length === 0) return null;

  return (
    <div className="px-4 space-y-4 mb-8">
      <h3 className="text-caption font-semibold" style={{ color }}>
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {categories.map((cat) => (
          <MBudgetMiniCard
            key={cat.id}
            name={cat.nom}
            spent={cat.depense}
            budget={cat.montant}
            isIncome={cat.isIncome}
            onClick={() => onCategoryClick(cat.id)}
            storedIsIncome={cat.storedIsIncome}
            onToggleSens={onToggleSens ? () => onToggleSens(cat.id, cat.storedIsIncome) : undefined}
            expectedPct={expectedPct}
          />
        ))}
      </div>
    </div>
  );
};
