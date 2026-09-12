import React from 'react';
import { Text } from './Text';

interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Filet 1 px entre les lignes. Désactivable pour une liste très courte. */
  divided?: boolean;
  /** Retire le fond : la liste vit alors à l'intérieur d'une <Card>. */
  plain?: boolean;
  as?: React.ElementType;
}

/**
 * Conteneur de lignes.
 *
 * Le rayon et le débordement sont portés ICI, jamais par les lignes. C'est ce
 * qui supprime le chevauchement des coins : une ligne carrée dans un conteneur
 * arrondi avec `overflow-hidden` épouse le coin exactement, là où une ligne
 * arrondie dans un conteneur arrondi laissait toujours un liseré.
 */
export const List = React.forwardRef<HTMLDivElement, ListProps>(
  ({ divided = true, plain = false, as: Tag = 'div', className = '', children, ...props }, ref) => (
    <Tag
      ref={ref}
      className={[
        plain ? '' : 'bg-surface rounded-lg overflow-hidden',
        divided ? '[&>*+*]:border-t [&>*+*]:border-separator' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Tag>
  ),
);

List.displayName = 'List';

interface ListItemProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Icône, avatar ou tuile en tête de ligne. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Montant, badge ou chevron en fin de ligne. */
  trailing?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** Rend la ligne plus dense — s'aligne sur le mode compact global. */
  compact?: boolean;
  as?: React.ElementType;
}

/**
 * Ligne de liste. Hauteur 56 px, 44 en compact — le plancher de cible tactile,
 * jamais moins.
 */
export const ListItem = React.forwardRef<HTMLElement, ListItemProps>(
  (
    { leading, title, subtitle, trailing, onClick, compact = false, as, className = '', ...props },
    ref,
  ) => {
    const interactive = Boolean(onClick);
    const Tag = as ?? (interactive ? 'button' : 'div');

    return (
      <Tag
        ref={ref}
        onClick={onClick}
        type={Tag === 'button' ? 'button' : undefined}
        className={[
          'density-row flex w-full items-center gap-4 px-4 text-left',
          compact ? 'min-h-12 py-1' : 'min-h-14 py-2',
          interactive
            ? 'transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {leading && (
          <span className="density-row-icon flex shrink-0 items-center justify-center overflow-hidden">
            {leading}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {typeof title === 'string' ? (
            <Text variant="headline" truncate>
              {title}
            </Text>
          ) : (
            title
          )}
          {typeof subtitle === 'string' ? (
            <Text variant="footnote" tone="tertiary" truncate>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </span>
        {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      </Tag>
    );
  },
);

ListItem.displayName = 'ListItem';

/** Tuile d'icône de ligne. 40 px, rayon 8 — strictement inférieur à la carte. */
export const Tile: React.FC<{
  tone?: 'accent' | 'neutral';
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', className = '', children }) => (
  <span
    className={[
      'grid h-10 w-10 place-items-center rounded-sm',
      tone === 'accent' ? 'bg-gold-subtle text-gold' : 'bg-raised text-label-secondary',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    aria-hidden="true"
  >
    {children}
  </span>
);
