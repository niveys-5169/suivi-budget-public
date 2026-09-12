import React from 'react';

export type BadgeTone = 'accent' | 'positive' | 'negative' | 'warning' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  accent: 'bg-gold-subtle text-gold',
  positive: 'bg-positive-subtle text-positive',
  negative: 'bg-negative-subtle text-negative',
  warning: 'bg-warning-subtle text-warning',
  neutral: 'bg-raised text-label-secondary',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Pastille de couleur avant le libellé — pour un état, pas pour décorer. */
  dot?: boolean;
}

/**
 * Étiquette d'état. Casse normale : le système n'a plus de badge en capitales.
 */
export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}) => (
  <span
    className={`inline-flex h-6 items-center gap-2 rounded-sm px-2 text-caption font-semibold ${TONE[tone]} ${className}`}
    {...props}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
    {children}
  </span>
);

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Filtre sélectionnable. Cible tactile 36 px minimum. */
export const Chip: React.FC<ChipProps> = ({
  selected = false,
  className = '',
  children,
  type,
  ...props
}) => (
  <button
    type={type ?? 'button'}
    aria-pressed={selected}
    className={[
      'inline-flex min-h-9 items-center gap-2 rounded-md px-4 text-subhead font-semibold transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
      selected ? 'bg-gold-subtle text-gold' : 'bg-raised text-label-secondary hover:text-label',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...props}
  >
    {children}
  </button>
);

interface ProgressBarProps {
  /** Taux de remplissage, borné à [0, 1] pour l'affichage. */
  value: number;
  tone?: 'accent' | 'positive' | 'warning' | 'negative';
  /** Étiquette accessible — sinon la barre est muette au lecteur d'écran. */
  label?: string;
  className?: string;
}

const BAR_TONE: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-gold',
  positive: 'bg-positive',
  warning: 'bg-warning',
  negative: 'bg-negative',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = 'accent',
  label,
  className = '',
}) => {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-sm bg-white/8 ${className}`}
    >
      <div
        className={`h-full rounded-sm transition-[width] duration-500 ${BAR_TONE[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};
