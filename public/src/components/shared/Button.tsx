import React from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  as?: React.ElementType;
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]';

const VARIANT_CLS: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-bg hover:bg-gold-light rounded-control',
  ghost:
    'bg-surface border border-separator text-label-secondary hover:text-white hover:bg-raised rounded-control',
  danger:
    'bg-negative-subtle border border-negative/30 text-negative hover:bg-negative/20 rounded-control',
  icon: 'bg-surface border border-separator text-label-secondary hover:text-white hover:bg-raised rounded-control',
};

const SIZE_CLS: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-4 text-xs',
  md: 'min-h-[44px] px-6 text-sm',
  lg: 'min-h-[52px] px-8 text-base',
};

const ICON_SIZE_CLS: Record<ButtonSize, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-13 w-13',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      loading = false,
      as: Tag = 'button',
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizeClass = variant === 'icon' ? ICON_SIZE_CLS[size] : SIZE_CLS[size];
    return (
      <Tag
        ref={ref}
        className={`${BASE} ${VARIANT_CLS[variant]} ${sizeClass} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span
            className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden
          />
        ) : null}
        {children}
      </Tag>
    );
  },
);

Button.displayName = 'Button';
