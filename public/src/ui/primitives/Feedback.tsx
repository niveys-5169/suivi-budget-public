import React from 'react';
import { Text } from './Text';
import { Button } from './Button';
import { Stack } from './Stack';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <Stack align="center" gap="md" className="px-6 py-12 text-center">
    {icon && (
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-raised text-label-tertiary"
        aria-hidden="true"
      >
        {icon}
      </span>
    )}
    <Stack gap="xs" align="center">
      <Text variant="headline">{title}</Text>
      {description && (
        <Text variant="footnote" tone="tertiary" className="max-w-xs">
          {description}
        </Text>
      )}
    </Stack>
    {action && (
      <Button variant="primary" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </Stack>
);

interface SkeletonProps {
  className?: string;
  /** Variante dorée pour les zones de solde et de patrimoine. */
  tone?: 'neutral' | 'accent';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', tone = 'neutral' }) => (
  <div
    aria-hidden="true"
    className={[
      'rounded-sm',
      tone === 'accent' ? 'animate-shimmer-gold' : 'bg-raised animate-shimmer',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  />
);

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  /** Lien ou bouton aligné à droite du titre. */
  action?: React.ReactNode;
}

/**
 * Bloc de contenu titré.
 *
 * Le titre et le vide suffisent à séparer les sections : ni bordure, ni fond,
 * ni carte englobante — c'est ce qui remplace l'emboîtement de l'ancien code.
 */
export const Section: React.FC<SectionProps> = ({
  title,
  action,
  className = '',
  children,
  ...props
}) => (
  <section className={`flex flex-col gap-2 ${className}`} {...props}>
    {(title || action) && (
      <div className="flex items-baseline justify-between gap-4 px-1">
        {title && (
          <Text as="h2" variant="title3">
            {title}
          </Text>
        )}
        {action}
      </div>
    )}
    {children}
  </section>
);
