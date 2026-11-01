import type { UseProjectionResult } from '../../../hooks/useProjection';
import type { ProjectionParams } from '../../../types/banking.types';

/** Données de l'app utiles aux éditeurs (valeurs observées, catégories, crédits). */
export type EditorContext = Pick<UseProjectionResult, 'observed' | 'categories' | 'credits'>;

/** Props communes des sections : le brouillon et son setter. */
export interface SectionProps {
  draft: ProjectionParams;
  onChange: (next: ProjectionParams) => void;
}

export interface ContextSectionProps extends SectionProps {
  ctx: EditorContext;
}
