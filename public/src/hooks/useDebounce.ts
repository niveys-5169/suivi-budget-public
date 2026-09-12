import { useState, useEffect } from 'react';

/** Retarde la propagation d'une valeur de `delay` ms — utile pour les champs de recherche. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
