import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useHaptics } from '../../hooks/useHaptics';
import { Text } from './Text';
import { IconButton } from './Button';

export type SheetSize = 'sm' | 'md' | 'lg';
export type SheetVariant = 'sheet' | 'centered';

const MAX_W: Record<SheetSize, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
};

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Actions dans l'en-tête, à gauche du bouton de fermeture. */
  headerActions?: React.ReactNode;
  size?: SheetSize;
  /** `sheet` remonte du bas sur mobile ; `centered` reste centré partout. */
  variant?: SheetVariant;
  fullHeight?: boolean;
  className?: string;
}

/**
 * Surface flottante — élévation 3, la seule à conserver ombre et flou.
 *
 * La mécanique d'accessibilité (piège de focus, Escape, portail, swipe-to-close,
 * safe-area) est reprise telle quelle de l'ancien `shared/Modal` : elle était
 * saine. Ce qui change est le style, l'API — ajout de `Sheet.Body` et
 * `Sheet.Footer`, annoncés par la documentation mais jamais implémentés — et
 * le titre, qui n'est plus en capitales italiques.
 */
const SheetRoot: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  headerActions,
  size = 'md',
  variant = 'sheet',
  fullHeight = true,
  className = '',
}) => {
  const titleId = useId();
  const reduced = useReducedMotion();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const drag = useDragControls();
  const { light } = useHaptics();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [isOpen, onClose]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const asSheet = variant === 'sheet';

  const entry = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : asSheet && isMobile
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
      : {
          initial: { scale: 0.96, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.96, opacity: 0 },
        };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className={`fixed inset-0 z-modal flex justify-center bg-black/70 ${asSheet ? 'items-end md:items-center md:p-4' : 'items-center p-4'}`}
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
        >
          <motion.div
            {...entry}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            drag={asSheet && isMobile ? 'y' : false}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) {
                light();
                onClose();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className={[
              'relative flex w-full flex-col overflow-hidden bg-surface shadow-floating focus:outline-none',
              MAX_W[size],
              asSheet ? 'rounded-t-xl md:rounded-xl' : 'rounded-xl',
              fullHeight ? 'max-h-[92dvh]' : 'max-h-[80dvh]',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {asSheet && (
              <div
                className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing md:hidden"
                aria-hidden="true"
                onPointerDown={(e) => drag.start(e)}
              >
                <span className="h-1 w-10 rounded-full bg-white/25" />
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-4 py-4">
              <div className="flex min-w-0 flex-col">
                <Text as="h2" id={titleId} variant="title3" truncate>
                  {title}
                </Text>
                {subtitle && (
                  <Text variant="footnote" tone="tertiary" truncate>
                    {subtitle}
                  </Text>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
                <IconButton label="Fermer" variant="plain" onClick={onClose}>
                  <X size={20} aria-hidden="true" />
                </IconButton>
              </div>
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const Body: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`no-scrollbar flex-1 overflow-y-auto p-4 ${className}`} {...props} />
);

const Footer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div
    className={`flex shrink-0 items-center justify-end gap-2 border-t border-separator p-4 pb-safe-md ${className}`}
    {...props}
  />
);

export const Sheet = Object.assign(SheetRoot, { Body, Footer });

/** Modale centrée — même surface, sans le comportement de remontée mobile. */
export const Modal: React.FC<Omit<SheetProps, 'variant'>> = (props) => (
  <SheetRoot {...props} variant="centered" />
);
