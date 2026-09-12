import React from 'react';

/** Pas d'espacement du système. Multiples de 8 px, sauf `xs` (sous-pas de 4). */
export type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const GAP: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1', // 4
  sm: 'gap-2', // 8
  md: 'gap-4', // 16
  lg: 'gap-6', // 24
  xl: 'gap-8', // 32
  '2xl': 'gap-12', // 48
};

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const;

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column';
  gap?: Gap;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  as?: React.ElementType;
}

/**
 * Mise en page par `gap` plutôt que par marges.
 *
 * Les marges individuelles se cumulent ou s'effondrent silencieusement, ce qui
 * produit les espacements incohérents que la refonte corrige. Passer par un
 * conteneur rend le rythme vérifiable.
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'column',
      gap = 'md',
      align,
      justify,
      wrap = false,
      as: Tag = 'div',
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const cls = [
      'flex',
      direction === 'row' ? 'flex-row' : 'flex-col',
      GAP[gap],
      align ? ALIGN[align] : '',
      justify ? JUSTIFY[justify] : '',
      wrap ? 'flex-wrap' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Tag ref={ref} className={cls} {...props}>
        {children}
      </Tag>
    );
  },
);

Stack.displayName = 'Stack';

/** Filet 1 px — la seule bordure du système. */
export const Separator: React.FC<{ className?: string; vertical?: boolean }> = ({
  className = '',
  vertical = false,
}) => (
  <div
    role="separator"
    aria-orientation={vertical ? 'vertical' : 'horizontal'}
    className={
      vertical
        ? `w-px self-stretch bg-separator ${className}`
        : `h-px w-full bg-separator ${className}`
    }
  />
);
