import React, { createContext, useContext } from 'react';

/**
 * Vrai dès qu'on est à l'intérieur d'une <Card>.
 *
 * Le système interdit d'imbriquer une carte dans une carte : c'est la source
 * n°1 des coins qui se chevauchent, et l'ancien code allait jusqu'à cinq
 * niveaux d'emboîtement. Plutôt que de compter sur la relecture, on le rend
 * détectable : en développement, une <Card> dans une <Card> émet une erreur
 * console nommant le composant fautif.
 */
const InsideCard = createContext(false);

export type CardPadding = 'none' | 'sm' | 'md';

/**
 * `md` porte le crochet `density-card` : c'est le seul palier assez large pour
 * qu'un cran de moins (16 → 12) se voie sans tasser le contenu. `sm` vaut déjà
 * 8 px, soit le plancher du système.
 */
const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-2',
  md: 'density-card p-4',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `md` (16 px) par défaut. `none` quand la carte contient une <List>. */
  padding?: CardPadding;
  /**
   * Ajoute un filet 1 px (élévation 2). Par défaut la carte n'a ni bordure ni
   * ombre : elle se détache du fond par sa seule surface.
   */
  bordered?: boolean;
  /** Rend la carte cliquable, avec l'état de survol et la cible tactile. */
  interactive?: boolean;
  as?: React.ElementType;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = 'md',
      bordered = false,
      interactive = false,
      as: Tag = 'div',
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const nested = useContext(InsideCard);

    if (import.meta.env.DEV && nested) {
      console.error(
        '[DesignSystem] <Card> imbriquée dans une <Card>. Le système ne l’autorise pas :\n' +
          'utilise <List>/<ListItem> pour une liste, ou <Stack> + <Separator> pour des blocs.\n' +
          'Voir DESIGN_SYSTEM.md § Cartes.',
      );
    }

    const cls = [
      'bg-surface rounded-lg',
      bordered ? 'border border-separator' : '',
      interactive ? 'text-left transition-colors hover:bg-raised active:bg-raised' : '',
      PADDING[padding],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <InsideCard.Provider value={true}>
        <Tag ref={ref} className={cls} {...props}>
          {children}
        </Tag>
      </InsideCard.Provider>
    );
  },
);

Card.displayName = 'Card';

/**
 * Surface secondaire — même fond que la carte mais sans rayon ni contexte
 * d'imbrication. À utiliser pour un bandeau pleine largeur ou un fond de
 * section, jamais comme conteneur de contenu arrondi.
 */
export const Surface = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`bg-surface ${className}`} {...props}>
      {children}
    </div>
  ),
);

Surface.displayName = 'Surface';
