import React, { createContext, useContext } from 'react';
import { NavBar } from './NavBar';

/**
 * Vrai quand un ancêtre applique déjà la largeur de lecture et le padding
 * horizontal.
 *
 * L'ancien code empilait `premium-container` jusqu'à trois fois sur la même
 * page (le wrapper de route, puis l'écran, puis un sous-conteneur), ce qui
 * doublait la marge et la largeur maximale. Le contexte rend l'imbrication
 * inoffensive pendant la migration : le conteneur le plus externe gagne, les
 * suivants deviennent transparents.
 */
const ContainerApplied = createContext(false);

/** À poser par le wrapper de route tant que tous les écrans n'ont pas migré. */
export const ContainerBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ContainerApplied.Provider value={true}>{children}</ContainerApplied.Provider>
);

interface ScreenProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Actions de la NavBar. Ignoré si `title` est absent. */
  actions?: React.ReactNode;
  /** Bandeau de contrôles collé sous la NavBar (filtres, période). */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  /** Largeur de lecture. `full` pour les tableaux larges. */
  width?: 'default' | 'full';
  className?: string;
}

/**
 * Coquille d'écran — NavBar + contenu + marge basse pour la TabBar.
 *
 * L'espacement vertical entre blocs vaut 24 px, sur la grille.
 */
export const Screen: React.FC<ScreenProps> = ({
  title,
  subtitle,
  onBack,
  actions,
  toolbar,
  children,
  width = 'default',
  className = '',
}) => {
  const alreadyContained = useContext(ContainerApplied);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {title && <NavBar title={title} subtitle={subtitle} onBack={onBack} actions={actions} />}
      {toolbar}
      <ContainerApplied.Provider value={true}>
        <main
          className={[
            'density-screen flex flex-1 flex-col gap-6',
            alreadyContained ? '' : 'px-4 pt-4 pb-nav-safe md:px-6',
            !alreadyContained && width === 'default' ? 'mx-auto w-full max-w-5xl' : 'w-full',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </main>
      </ContainerApplied.Provider>
    </div>
  );
};
