import React from 'react';
import { Text } from '../../ui';

type MScreenHeaderProps = {
  title: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
};

/**
 * En-tête d'écran mobile.
 *
 * Aligné sur <NavBar> : même hauteur de 56 px et même variante de titre. Ce
 * composant reste distinct parce que les écrans mobile vivent dans un shell à
 * hauteur fixe qui gère lui-même la safe-area — il ne doit donc ni se coller
 * ni ajouter de padding haut, contrairement à <NavBar>.
 */
export const MScreenHeader: React.FC<MScreenHeaderProps> = ({ title, leftAction, rightAction }) => (
  <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
    <div className="flex min-w-0 items-center gap-2">
      {leftAction && <div className="flex shrink-0 items-center">{leftAction}</div>}
      <Text as="h1" variant="title3" truncate>
        {title}
      </Text>
    </div>
    {rightAction && <div className="flex shrink-0 items-center gap-2">{rightAction}</div>}
  </header>
);
