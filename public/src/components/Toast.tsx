import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
  duration: number;
}

export const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleShow = (event: Event) => {
      const { type, message, duration = 4000, id: customId } = (event as CustomEvent).detail;
      const id = customId ?? Date.now().toString();

      setToasts((prev) => {
        // Replace if same id already exists (e.g. update a persistent loading toast)
        const exists = prev.find((t) => t.id === id);
        const next = exists
          ? prev.map((t) => (t.id === id ? { id, type, message, duration } : t))
          : [...prev, { id, type, message, duration }];
        return next;
      });

      if (duration > 0) {
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
      }
    };

    const handleDismiss = (event: Event) => {
      const { id } = (event as CustomEvent).detail;
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    window.addEventListener('show-toast', handleShow);
    window.addEventListener('dismiss-toast', handleDismiss);
    return () => {
      window.removeEventListener('show-toast', handleShow);
      window.removeEventListener('dismiss-toast', handleDismiss);
    };
  }, []);

  const styleMap = {
    success: 'bg-positive/10 border-positive text-positive',
    error: 'bg-negative/10 border-negative/30 text-negative',
    info: 'bg-gold/10 border-gold/30 text-gold',
    loading: 'bg-white/5 border-separator text-label/80',
  };

  const iconMap = {
    success: <CheckCircle2 size={18} className="flex-shrink-0" />,
    error: <AlertCircle size={18} className="flex-shrink-0" />,
    info: <Info size={18} className="flex-shrink-0" />,
    loading: <Loader2 size={18} className="flex-shrink-0 animate-spin" />,
  };

  return (
    <div
      className="fixed right-4 z-[200] flex flex-col gap-4 pointer-events-none max-w-sm md:bottom-4"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, x: 100 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 100 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100 }}
            className={`flex items-center gap-4 px-4 py-4 rounded-xl border backdrop-blur-md pointer-events-auto shadow-lg ${styleMap[toast.type]}`}
          >
            {iconMap[toast.type]}
            <span className="text-sm font-semibold">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
