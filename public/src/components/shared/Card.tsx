import React from 'react';

type CardVariant = 'default' | 'subtle' | 'elevated';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  as?: React.ElementType;
}

const VARIANT_CLS: Record<CardVariant, string> = {
  default: 'bg-surface border border-separator backdrop-blur-xl',
  subtle: 'bg-surface border border-separator',
  elevated: 'bg-surface border border-separator backdrop-blur-xl shadow-card',
};

const PADDING_CLS = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = 'default', padding = 'md', as: Tag = 'div', className = '', children, ...props },
    ref,
  ) => {
    return (
      <Tag
        ref={ref}
        className={`rounded-card ${VARIANT_CLS[variant]} ${PADDING_CLS[padding]} ${className}`}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

Card.displayName = 'Card';
