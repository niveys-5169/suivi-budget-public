import React from 'react';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Étiquette du groupe pour les lecteurs d'écran. */
  label: string;
  /** Répartit les segments sur toute la largeur. */
  block?: boolean;
  className?: string;
}

/**
 * Sélecteur segmenté.
 *
 * Remplace trois implémentations qui émettaient déjà les mêmes classes :
 * shared/PeriodPills, mobile/MSegmentedControl et mobile/components/shared/Segmented.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  block = false,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={[
        'inline-flex gap-1 rounded-md bg-raised p-1',
        block ? 'flex w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {segments.map((seg) => {
        const selected = seg.value === value;
        return (
          <button
            key={seg.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(seg.value)}
            className={[
              'min-h-9 rounded-sm px-4 text-subhead font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
              block ? 'flex-1' : '',
              selected ? 'bg-gold-subtle text-gold' : 'text-label-secondary hover:text-label',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
