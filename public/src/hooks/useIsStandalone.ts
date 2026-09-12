import { useEffect, useState } from 'react';

/**
 * Détecte si l'app tourne en mode PWA installée (display-mode: standalone),
 * y compris le cas iOS legacy (`navigator.standalone`). Réagit aux changements
 * de `matchMedia` (ex. bascule fenêtré ↔ standalone).
 *
 * Sert à réserver certains gestes (swipe-to-point) à la PWA installée et non
 * au simple navigateur mobile.
 */
const readStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone) return true;
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
};

export const useIsStandalone = (): boolean => {
  const [isStandalone, setIsStandalone] = useState<boolean>(readStandalone);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(display-mode: standalone)');
    const update = () => setIsStandalone(readStandalone());
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isStandalone;
};
