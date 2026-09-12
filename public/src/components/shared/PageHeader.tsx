import React, { ReactNode } from 'react';
import { NavBar } from '../../ui';

interface Props {
  title: string;
  /** Small subtitle below the title (e.g., active period, record count). */
  subtitle?: string;
  /**
   * Icône décorative devant le titre.
   *
   * Plus rendue : une barre de navigation iOS porte un titre, pas un ornement.
   * Le paramètre subsiste pour ne pas casser les appelants existants.
   */
  icon?: ReactNode;
  onBack?: () => void;
  rightActions?: ReactNode;
}

/**
 * En-tête de page — adaptateur vers <NavBar>.
 *
 * Conservé pour ne pas réécrire tous les appelants d'un coup. Le titre n'est
 * plus en capitales et le filet doré dégradé a disparu : le système sépare par
 * l'espace, pas par l'ornement.
 */
export const PageHeader: React.FC<Props> = ({ title, subtitle, onBack, rightActions }) => (
  <NavBar title={title} subtitle={subtitle} onBack={onBack} actions={rightActions} />
);
