import { useEffect, useState } from 'react';

/**
 * Vrai une fois `ms` écoulées depuis le montage.
 *
 * Sert aux indicateurs de chargement : un chargement plus court que le délai
 * n'affiche rien, ce qui évite le flash d'un spinner qui disparaît aussitôt.
 */
export function useDelayedVisible(ms: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return visible;
}
