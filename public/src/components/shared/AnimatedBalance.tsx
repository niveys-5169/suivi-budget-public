import React, { useEffect, useState } from 'react';
import { useSpring, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { formatCurrency } from '../../lib/formatters';
import { Currency } from '../../types/banking.types';

interface AnimatedBalanceProps {
  value: number;
  currency?: Currency;
  className?: string;
}

/**
 * Affiche un montant formaté qui « roule » en douceur (spring) vers sa nouvelle
 * valeur à chaque mise à jour des données — l'effet « private banking » d'un
 * solde qui se réconcilie. La première valeur est affichée immédiatement (pas
 * de comptage depuis zéro), seules les variations suivantes sont animées.
 *
 * Respecte `prefers-reduced-motion` : dans ce cas la valeur saute sans animation.
 */
export const AnimatedBalance: React.FC<AnimatedBalanceProps> = ({
  value,
  currency = 'EUR',
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 60, damping: 22, mass: 1 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduceMotion) {
      spring.jump(value);
      setDisplay(value);
    } else {
      spring.set(value);
    }
  }, [value, reduceMotion, spring]);

  useMotionValueEvent(spring, 'change', (v) => setDisplay(v));

  return (
    <span className={className}>{formatCurrency(reduceMotion ? value : display, currency)}</span>
  );
};
