import React from 'react';
import { ContainerBoundary } from '../../ui/primitives/Screen';

interface PageLayoutProps {
  children: React.ReactNode;
  /** Extra classes on the outer container. */
  className?: string;
}

/**
 * Conteneur de route — largeur de lecture, padding horizontal, marge basse
 * pour la TabBar.
 *
 * C'est le SEUL endroit où `premium-container` est appliqué. Cinq écrans le
 * réappliquaient par-dessus, doublant la marge et la largeur maximale ; ils ont
 * été corrigés. `ContainerBoundary` prévient les <Screen> descendants que le
 * conteneur est déjà posé, pour qu'ils ne le reposent pas pendant la migration.
 */
export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => (
  <ContainerBoundary>
    <div className={`premium-container ${className}`}>{children}</div>
  </ContainerBoundary>
);
