import React from 'react';
import { CHART_COLORS } from '../../lib/colors';
import { ChevronRight, PieChart } from 'lucide-react';
import { fmt } from '../../utils/format';

interface Props {
  spent: number;
  total: number;
  onClick: () => void;
}

export const AnalyseBudgetRow: React.FC<Props> = ({ spent, total, onClick }) => {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const isExceeded = total > 0 && spent > total;

  return (
    <button
      onClick={onClick}
      className="w-full bg-surface rounded-lg p-4 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center justify-between mb-2 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <PieChart size={14} className="text-violet-400 shrink-0" />
          <span className="text-caption font-bold text-label-secondary whitespace-nowrap">
            Budget
          </span>
          {isExceeded && (
            <span className="text-caption font-bold text-negative bg-negative/10 px-2 py-1 rounded whitespace-nowrap">
              Dépassé
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-serif font-semibold text-sm [font-variant-numeric:tabular-nums] text-label">
            {fmt(spent)}
          </span>
          <span className="text-label-tertiary text-xs">/</span>
          <span className="font-serif text-sm [font-variant-numeric:tabular-nums] text-label-tertiary">
            {fmt(total)}
          </span>
          <ChevronRight size={14} className="text-label-tertiary ml-1" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              backgroundColor: isExceeded ? CHART_COLORS.ruby : '#818CF8',
            }}
          />
        </div>
        <span
          className={`text-caption font-bold tabular-nums ${isExceeded ? 'text-negative' : 'text-label-tertiary'}`}
        >
          {pct.toFixed(0)} %
        </span>
      </div>
    </button>
  );
};
