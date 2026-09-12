import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CategoryDeltaBadgeProps {
  deltaPct: number | null;
}

export const CategoryDeltaBadge: React.FC<CategoryDeltaBadgeProps> = ({ deltaPct }) => {
  if (deltaPct === null || deltaPct === 0) return null;

  const isUp = deltaPct > 0;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-caption font-semibold ${
        isUp
          ? 'bg-negative/10 border border-negative/20 text-negative'
          : 'bg-positive/10 border border-positive/20 text-positive'
      }`}
    >
      {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
      {isUp ? '+' : ''}
      {Math.round(deltaPct)} %
    </span>
  );
};
