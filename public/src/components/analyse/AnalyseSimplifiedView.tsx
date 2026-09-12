import React from 'react';
import { ChevronRight } from 'lucide-react';
import { fmt } from '../../utils/format';
import { BUCKET_COLORS, BUCKET_ORDER } from '../../utils/simplifiedBuckets';
import type { SimplifiedBucketData, DrillDownView } from './analyseTypes';

interface Props {
  buckets: SimplifiedBucketData[];
  onDrillDown: (view: DrillDownView) => void;
}

export const AnalyseSimplifiedView: React.FC<Props> = ({ buckets, onDrillDown }) => {
  const sorted = BUCKET_ORDER.map((b) => buckets.find((x) => x.bucket === b)).filter(
    Boolean,
  ) as SimplifiedBucketData[];
  const nonEmpty = sorted.filter((b) => b.amount > 0);
  const total = sorted.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      {/* Multi-color horizontal bar */}
      {total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-white/5">
          {nonEmpty.map((b) => (
            <div
              key={b.bucket}
              className="h-full transition-all duration-700"
              style={{
                width: `${(b.amount / total) * 100}%`,
                backgroundColor: BUCKET_COLORS[b.bucket],
              }}
            />
          ))}
        </div>
      )}

      {/* Bucket rows */}
      <div className="bg-surface rounded-xl overflow-hidden divide-y divide-separator border border-separator">
        {sorted.map((b) => {
          const color = BUCKET_COLORS[b.bucket];
          return (
            <button
              key={b.bucket}
              onClick={() =>
                onDrillDown({ type: 'bucket', bucket: b.bucket, categories: b.categories })
              }
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/5 transition-colors"
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl shrink-0 border"
                style={{
                  backgroundColor: `${color}20`,
                  borderColor: `${color}40`,
                }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-label text-sm">{b.bucket}</span>
                  <span className="font-serif font-semibold [font-variant-numeric:tabular-nums] text-label text-sm shrink-0">
                    {fmt(b.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${b.percentage}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-caption font-bold text-label-tertiary tabular-nums w-8 text-right">
                    {b.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              <ChevronRight size={16} className="text-label-tertiary shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Analyser link */}
      <button
        onClick={() => {
          /* stays in categories view — handled in parent */
        }}
        className="w-full text-center text-caption font-bold text-label-tertiary hover:text-label-secondary transition-colors py-2"
      >
        Analyser <ChevronRight size={10} className="inline" />
      </button>
    </div>
  );
};
