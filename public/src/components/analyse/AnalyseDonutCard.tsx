import React from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
import { DonutChart } from '../shared/DonutChart';
import { fmt } from '../../utils/format';
import { AnalyseBudgetRow } from './AnalyseBudgetRow';

interface CategoryData {
  name: string;
  amount: number;
  color: string;
}

interface Props {
  data: CategoryData[];
  total: number;
  label: string;
  activeIndex: number | null;
  onSegmentClick: (index: number | null) => void;
  accountCount?: number;
  onAccountsClick?: () => void;
  budgetSpent?: number;
  budgetTotal?: number;
  onBudgetClick?: () => void;
}

export const AnalyseDonutCard: React.FC<Props> = ({
  data,
  total,
  label,
  activeIndex,
  onSegmentClick,
  accountCount,
  onAccountsClick,
  budgetSpent,
  budgetTotal,
  onBudgetClick,
}) => {
  const chartData = data.map((d) => ({
    label: d.name,
    value: Math.abs(d.amount),
    color: d.color,
  }));

  const centerAmount =
    activeIndex !== null && data[activeIndex]
      ? fmt(Math.abs(data[activeIndex].amount))
      : fmt(total);

  return (
    <div className="bg-surface rounded-xl p-8 border border-separator">
      <div className="flex items-center justify-center min-h-[280px]">
        <DonutChart
          data={chartData}
          centerAmount={centerAmount}
          centerLabel={label}
          activeIndex={activeIndex}
          onSegmentClick={onSegmentClick}
        />
      </div>

      {/* Accounts link */}
      {accountCount !== undefined && onAccountsClick && (
        <button
          onClick={onAccountsClick}
          className="mt-4 mx-auto flex items-center gap-2 text-label-tertiary hover:text-label-secondary transition-colors"
        >
          <Building2 size={13} />
          <span className="text-caption font-bold">
            {accountCount} compte{accountCount > 1 ? 's' : ''}
          </span>
          <ChevronRight size={12} />
        </button>
      )}

      {/* Budget row */}
      {budgetTotal !== undefined && budgetTotal > 0 && onBudgetClick && (
        <div className="mt-4">
          <AnalyseBudgetRow spent={budgetSpent ?? 0} total={budgetTotal} onClick={onBudgetClick} />
        </div>
      )}
    </div>
  );
};
