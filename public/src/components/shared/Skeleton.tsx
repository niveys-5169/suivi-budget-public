import React from 'react';
import { Skeleton as UiSkeleton } from '../../ui';

interface SkeletonProps {
  className?: string;
  /** `gold` applique le reflet doré des zones solde/patrimoine. */
  variant?: 'default' | 'gold';
}

/**
 * Placeholder de chargement — adaptateur vers la primitive.
 *
 * Conservé pour ne pas réécrire tous les appelants d'un coup ; `variant`
 * correspond au `tone` de la primitive. Dimensionner via `className`.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'default' }) => (
  <UiSkeleton tone={variant === 'gold' ? 'accent' : 'neutral'} className={className} />
);
