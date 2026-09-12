import React from 'react';
import { ChevronRight, Building2 } from 'lucide-react';
import { fmt } from '../../utils/format';
import { AnalyseBudgetRow } from './AnalyseBudgetRow';
import type { DrillDownView } from './analyseTypes';

interface Props {
  totalEntrees: number;
  totalSorties: number;
  totalBudget: number;
  totalSpent: number;
  accountCount: number;
  onDrillDown: (view: DrillDownView) => void;
  onNavigateBudgets: () => void;
}

export const AnalyseOverviewTab: React.FC<Props> = ({
  totalEntrees,
  totalSorties,
  totalBudget,
  totalSpent,
  accountCount,
  onDrillDown,
  onNavigateBudgets,
}) => {
  const balance = totalEntrees - totalSorties;
  const isNegative = balance < 0;
  const total = totalEntrees + totalSorties;
  const entreesWidth = total > 0 ? (totalEntrees / total) * 100 : 50;

  return (
    <div className="space-y-4">
      {/* Balance card */}
      <div className="bg-surface rounded-xl p-8 border border-separator">
        <p className="text-caption font-bold text-label-tertiary mb-2">Balance</p>

        <p
          className={`font-serif text-5xl font-semibold [font-variant-numeric:tabular-nums] mb-6 ${
            isNegative ? 'text-negative' : 'text-positive'
          }`}
        >
          {fmt(balance)}
        </p>

        {/* Entrées / Sorties bar */}
        <div className="space-y-4">
          <div className="h-2.5 rounded-full overflow-hidden flex bg-white/5">
            <div
              className="h-full rounded-l-full transition-all duration-700"
              style={{ width: `${entreesWidth}%`, backgroundColor: '#52B788' }}
            />
            <div
              className="h-full rounded-r-full transition-all duration-700"
              style={{ width: `${100 - entreesWidth}%`, backgroundColor: '#818CF8' }}
            />
          </div>

          <div className="flex justify-between text-sm">
            <div>
              <p className="text-caption font-bold text-label-tertiary mb-1">Entrées</p>
              <p className="font-serif font-semibold text-positive [font-variant-numeric:tabular-nums]">
                {fmt(totalEntrees)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-caption font-bold text-label-tertiary mb-1">Sorties</p>
              <p className="font-serif font-semibold text-violet-400 [font-variant-numeric:tabular-nums]">
                {fmt(totalSorties)}
              </p>
            </div>
          </div>
        </div>

        {/* Accounts link */}
        <button
          onClick={() => onDrillDown({ type: 'accounts' })}
          className="mt-4 flex items-center gap-2 text-label-tertiary hover:text-label-secondary transition-colors"
        >
          <Building2 size={14} />
          <span className="text-caption font-bold">
            {accountCount} compte{accountCount > 1 ? 's' : ''}
          </span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Budget summary card */}
      {totalBudget > 0 && (
        <div className="space-y-2">
          <AnalyseBudgetRow spent={totalSpent} total={totalBudget} onClick={onNavigateBudgets} />
          <button
            onClick={onNavigateBudgets}
            className="w-full text-center text-caption font-bold text-label-tertiary hover:text-label-secondary transition-colors py-1"
          >
            Voir mon budget <ChevronRight size={10} className="inline" />
          </button>
        </div>
      )}
    </div>
  );
};
