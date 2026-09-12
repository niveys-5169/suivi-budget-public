import React from 'react';
import { Check } from 'lucide-react';
import { SegmentedControl, Chip } from '../../../ui';

export interface SegmentedOption {
  value: string;
  label: string;
}

/** Groupe à choix unique. Préréglage de <SegmentedControl>. */
export const Segmented: React.FC<{
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}> = ({ options, value, onChange, label = 'Filtre' }) => (
  <SegmentedControl label={label} segments={options} value={value} onChange={onChange} block />
);

/**
 * Groupe de chips multi-sélection avec option « Tous ».
 * `values === 'all'` (ou tableau vide) = tout sélectionné.
 */
export const ChipGroup: React.FC<{
  options: SegmentedOption[];
  values: string[] | 'all';
  onToggle: (value: string) => void;
  onAll: () => void;
  allLabel: string;
}> = ({ options, values, onToggle, onAll, allLabel }) => {
  const isAll = values === 'all' || values.length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Chip selected={isAll} onClick={onAll}>
        {isAll && <Check size={14} aria-hidden="true" />}
        {allLabel}
      </Chip>
      {options.map((opt) => {
        const active = !isAll && values.includes(opt.value);
        return (
          <Chip key={opt.value} selected={active} onClick={() => onToggle(opt.value)}>
            {active && <Check size={14} aria-hidden="true" />}
            {opt.label}
          </Chip>
        );
      })}
    </div>
  );
};
