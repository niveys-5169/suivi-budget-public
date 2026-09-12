import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive';
export type ControlSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-bg hover:bg-gold-light',
  secondary: 'bg-raised text-label hover:bg-raised/70',
  plain: 'bg-transparent text-gold hover:text-gold-light',
  destructive: 'bg-negative-subtle text-negative hover:bg-negative/20',
};

/** Hauteurs sur la grille ; `md` respecte la cible tactile de 44 px (Apple HIG). */
const SIZE: Record<ControlSize, string> = {
  sm: 'min-h-9 px-4 text-subhead',
  md: 'min-h-11 px-6 text-callout',
  lg: 'min-h-13 px-8 text-body',
};

const PLAIN_SIZE: Record<ControlSize, string> = {
  sm: 'min-h-9 px-2 text-subhead',
  md: 'min-h-11 px-2 text-callout',
  lg: 'min-h-13 px-4 text-body',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ' +
  'disabled:opacity-40 disabled:pointer-events-none';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  /** Occupe toute la largeur disponible (CTA de sheet, formulaire mobile). */
  block?: boolean;
  as?: React.ElementType;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      block = false,
      as: Tag = 'button',
      className = '',
      children,
      disabled,
      type,
      ...props
    },
    ref,
  ) => {
    const cls = [
      BASE,
      VARIANT[variant],
      variant === 'plain' ? PLAIN_SIZE[size] : SIZE[size],
      block ? 'w-full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Tag
        ref={ref}
        type={Tag === 'button' ? (type ?? 'button') : type}
        className={cls}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </Tag>
    );
  },
);

Button.displayName = 'Button';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatoire : un bouton icône sans nom accessible est invisible au lecteur d'écran. */
  label: string;
  size?: ControlSize;
  /** `plain` retire le fond — pour les barres de navigation. */
  variant?: 'secondary' | 'plain';
}

const ICON_SIZE: Record<ControlSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-13 w-13',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { label, size = 'md', variant = 'secondary', className = '', children, type, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      className={[
        'inline-grid place-items-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        'disabled:opacity-40 disabled:pointer-events-none',
        variant === 'plain'
          ? 'bg-transparent text-label-secondary hover:text-label'
          : 'bg-raised text-label-secondary hover:text-label',
        ICON_SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = 'IconButton';
