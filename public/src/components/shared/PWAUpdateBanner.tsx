import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const dismiss = () => setNeedRefresh(false);
  const reload = () => updateServiceWorker(true);

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          className="fixed left-4 right-4 z-[250] flex items-center gap-4 px-4 py-4 rounded-lg bg-[#0B0B14]/95 border border-gold/30 backdrop-blur-md"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
          role="status"
          aria-live="polite"
        >
          <div className="flex-1 min-w-0">
            <p className="text-caption font-semibold text-gold leading-none">
              Mise à jour disponible
            </p>
            <p className="text-caption text-label/50 mt-1 leading-snug">
              Rechargez pour appliquer la nouvelle version.
            </p>
          </div>
          <button
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-caption font-semibold hover:bg-gold/20 active:scale-95 transition-all flex-shrink-0"
            aria-label="Recharger l'application pour appliquer la mise à jour"
          >
            <RefreshCw size={12} strokeWidth={2.5} />
            Recharger
          </button>
          <button
            onClick={dismiss}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-label/40 hover:text-label/70 active:scale-95 transition-all flex-shrink-0"
            aria-label="Ignorer la mise à jour"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
