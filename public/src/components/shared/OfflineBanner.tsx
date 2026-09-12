import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useIntl } from 'react-intl';

type BannerState = 'offline' | 'back-online' | 'hidden';

export const OfflineBanner: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const [state, setState] = useState<BannerState>(() => (navigator.onLine ? 'hidden' : 'offline'));

  useEffect(() => {
    let backOnlineTimer: ReturnType<typeof setTimeout>;

    const handleOffline = () => {
      clearTimeout(backOnlineTimer);
      setState('offline');
    };

    const handleOnline = () => {
      setState('back-online');
      // Auto-hide "back online" confirmation after 3s
      backOnlineTimer = setTimeout(() => setState('hidden'), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearTimeout(backOnlineTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {state !== 'hidden' && (
        <motion.div
          key={state}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className={`fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 text-caption font-bold ${
            state === 'offline'
              ? 'bg-negative/90 text-white backdrop-blur-md'
              : 'bg-positive text-white backdrop-blur-md'
          }`}
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
          role="status"
          aria-live="polite"
        >
          {state === 'offline' ? (
            <WifiOff size={13} strokeWidth={2.5} />
          ) : (
            <Wifi size={13} strokeWidth={2.5} />
          )}
          {state === 'offline' ? t({ id: 'state.offline' }) : t({ id: 'state.backOnline' })}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
