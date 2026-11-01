import React from 'react';
import { useIntl } from 'react-intl';
import { useDelayedVisible } from '../../hooks/useDelayedVisible';

/** En deçà, un chargement passe inaperçu : aucun spinner ne clignote. */
export const LOADING_FALLBACK_DELAY_MS = 200;

interface LoadingFallbackProps {
  /** Couvre tout l'écran sur le fond de l'application (démarrage, bascule desktop ↔ mobile). */
  fullScreen?: boolean;
}

/**
 * Repli de `<Suspense>` : rien pendant 200 ms, puis un spinner discret.
 * En plein écran, le fond `bg-bg` évite tout éclair blanc entre deux arbres.
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({ fullScreen = false }) => {
  const { formatMessage: t } = useIntl();
  const visible = useDelayedVisible(LOADING_FALLBACK_DELAY_MS);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg'
          : 'flex flex-col items-center justify-center gap-4 p-8'
      }
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      <span className="text-footnote text-label-tertiary">{t({ id: 'state.loading.short' })}</span>
    </div>
  );
};
