import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import { _setConfirmHostMounted, type ConfirmRequest } from '../lib/confirm';

/**
 * Hôte du dialogue de confirmation accessible. À monter une fois par shell
 * (voir MainApp.tsx). Écoute l'évènement `app-confirm`
 * émis par `confirm()` (lib/confirm.ts) et rend le Modal WCAG.
 */
export const ConfirmHost: React.FC = () => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    _setConfirmHostMounted(true);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmRequest>).detail;
      if (detail) setQueue((q) => [...q, detail]);
    };
    window.addEventListener('app-confirm', handler);
    return () => {
      window.removeEventListener('app-confirm', handler);
      _setConfirmHostMounted(false);
    };
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      current?.resolve(value);
      setQueue((q) => q.slice(1));
    },
    [current],
  );

  if (!current) return null;
  const { options } = current;

  return (
    <Modal
      isOpen
      onClose={() => settle(false)}
      title={options.title ?? 'Confirmation'}
      size="sm"
      variant="centered"
      fullHeight={false}
    >
      <div className="space-y-6 p-1">
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
          {options.message}
        </p>
        <div className="flex justify-end gap-4">
          <Button variant="ghost" onClick={() => settle(false)}>
            {options.cancelLabel ?? 'Annuler'}
          </Button>
          <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
            {options.confirmLabel ?? 'Confirmer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
