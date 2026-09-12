import React from 'react';
import { Sheet, type SheetSize, type SheetVariant } from '../../ui';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional subtitle displayed below the title. */
  subtitle?: string;
  children: React.ReactNode;
  /** Extra classes on the inner dialog panel. */
  className?: string;
  /** When true the modal occupies up to 92dvh (default). Set to false for smaller modals. */
  fullHeight?: boolean;
  /** Optional actions (e.g., Save button) to display in the header. */
  headerActions?: React.ReactNode;
  /** Dialog max-width tier: 'sm' | 'md' (default) | 'lg'. */
  size?: SheetSize;
  /** 'sheet' (défaut) : remonte du bas sur mobile. 'centered' : toujours centré. */
  variant?: SheetVariant;
}

/**
 * Modale — adaptateur vers la primitive <Sheet>.
 *
 * Toute la mécanique (piège de focus, Escape, portail, swipe-to-close,
 * safe-area) vit désormais dans `ui/primitives/Sheet.tsx`, qui l'a reprise
 * telle quelle de ce fichier. Ne subsiste ici que l'adaptation d'API, le temps
 * que les appelants passent directement sur <Sheet>.
 *
 * Le corps n'a volontairement pas de padding — contrairement à `Sheet.Body` —
 * pour préserver le comportement des appelants existants, qui posent le leur.
 */
export const Modal: React.FC<ModalProps> = ({
  children,
  className = '',
  fullHeight = true,
  ...props
}) => (
  <Sheet {...props} fullHeight={fullHeight} className={className}>
    <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
  </Sheet>
);
