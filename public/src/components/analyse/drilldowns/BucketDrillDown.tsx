import React from 'react';
import { ChevronRight } from 'lucide-react';
import { fmt } from '../../../utils/format';
import { BUCKET_COLORS } from '../../../utils/simplifiedBuckets';
import { getCategoryMeta } from '../../../constants/categoryMetadata';
import { CategoryIcon } from '../../CategoryIcon';
import type { SimplifiedBucket, CategorySummary, DrillDownView } from '../analyseTypes';
import type { Transaction } from '../../../hooks/useTransactions';

interface Props {
  bucket: SimplifiedBucket;
  categories: CategorySummary[];
  transactions: Transaction[];
  onCategoryDrillDown: (view: DrillDownView) => void;
}

export const BucketDrillDown: React.FC<Props> = ({
  bucket,
  categories,
  transactions,
  onCategoryDrillDown,
}) => {
  const color = BUCKET_COLORS[bucket];
  const total = categories.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="px-4 md:px-6 space-y-6 pt-6">
      {/* Bucket header */}
      <div className="p-4">
        <p className="text-caption font-bold text-label-tertiary mb-2">{bucket}</p>
        <p
          className="font-serif text-4xl font-semibold [font-variant-numeric:tabular-nums]"
          style={{ color }}
        >
          {fmt(total)}
        </p>
        <p className="text-xs text-label-tertiary mt-1">
          {categories.length} catégorie{categories.length > 1 ? 's' : ''} •{' '}
          {
            transactions.filter((tx) =>
              categories.some((c) => c.name === (tx.categorie || 'Non catégorisé')),
            ).length
          }{' '}
          transactions
        </p>
      </div>

      {/* Categories list */}
      <div>
        <h3 className="text-caption font-bold text-label-tertiary px-2 mb-4">Catégories</h3>
        <div className="divide-y divide-separator">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat.name);
            return (
              <button
                key={cat.name}
                onClick={() =>
                  onCategoryDrillDown({
                    type: 'category',
                    categoryName: cat.name,
                    tab: 'sorties',
                  })
                }
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors group"
              >
                <div
                  className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cat.color}15`,
                    borderColor: `${cat.color}30`,
                    color: cat.color,
                  }}
                >
                  <CategoryIcon icon={meta.icon} size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-label text-sm truncate" title={cat.name}>
                      {cat.name}
                    </span>
                    <span className="font-serif font-semibold text-sm [font-variant-numeric:tabular-nums] text-label ml-2 shrink-0">
                      {fmt(cat.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                    <span className="text-caption text-label-tertiary font-bold tabular-nums">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className="text-label-tertiary group-hover:text-label-secondary transition-colors shrink-0"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
