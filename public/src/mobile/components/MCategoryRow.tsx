import React from 'react';
import { FormattedNumber } from 'react-intl';
import { EyeOff, Eye } from 'lucide-react';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';

interface MCategoryRowProps {
  name: string;
  amount: number;
  percentage: number;
  onToggleHide?: (name: string) => void;
  isHidden?: boolean;
}

export const MCategoryRow: React.FC<MCategoryRowProps> = ({
  name,
  amount,
  percentage,
  onToggleHide,
  isHidden = false,
}) => {
  const meta = getCategoryMeta(name);

  return (
    <div className="flex items-center gap-4 py-4 px-4 active:bg-surface transition-colors group">
      <div
        className="w-10 h-10 rounded-control flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
      >
        <CategoryIcon icon={meta.icon} size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-2">
          <p className="text-headline font-medium text-white truncate pr-2">{name}</p>
          <p className="text-headline font-bold text-white tabular-nums shrink-0">
            <FormattedNumber value={Math.abs(amount)} style="currency" currency="EUR" />
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${percentage}%`, backgroundColor: meta.color }}
            />
          </div>
          <span className="text-footnote font-bold text-label-tertiary w-9 text-right">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      {onToggleHide && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleHide(name);
          }}
          className={`p-2 rounded-lg transition-colors shrink-0 hover:bg-white/10 ${
            isHidden ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-active:opacity-100'
          }`}
          title={isHidden ? 'Afficher' : "Masquer de l'analyse"}
        >
          {isHidden ? (
            <Eye size={16} className="text-gold/50" />
          ) : (
            <EyeOff size={16} className="text-label-secondary" />
          )}
        </button>
      )}
    </div>
  );
};
