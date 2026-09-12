import React from 'react';
import { formatCurrency } from '../../lib/formatters';
import type { Currency } from '../../types/banking.types';
import { Text, TextVariant, TextTone } from './Text';

interface AmountProps {
  value: number | null | undefined;
  currency?: Currency;
  /** `auto` (défaut) colore selon le signe ; sinon force une tonalité. */
  tone?: 'auto' | 'neutral' | TextTone;
  variant?: TextVariant;
  /** Affiche `+` devant les montants positifs (utile dans un flux). */
  signed?: boolean;
  className?: string;
  as?: React.ElementType;
}

/**
 * Affichage d'un montant.
 *
 * Porte la décision de sémantique couleur du système : l'or est réservé aux
 * accents interactifs, la valeur financière s'exprime en vert/rouge. Un solde
 * et un bouton ne peuvent plus avoir la même couleur.
 */
export const Amount: React.FC<AmountProps> = ({
  value,
  currency = 'EUR',
  tone = 'auto',
  variant = 'headline',
  signed = false,
  className = '',
  as,
}) => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null;

  let resolved: TextTone;
  if (tone === 'auto') {
    resolved = n === null || n === 0 ? 'secondary' : n > 0 ? 'positive' : 'negative';
  } else if (tone === 'neutral') {
    resolved = 'primary';
  } else {
    resolved = tone;
  }

  const body = n === null ? '—' : formatCurrency(n, currency);
  const prefix = signed && n !== null && n > 0 ? '+ ' : '';

  return (
    <Text as={as} variant={variant} tone={resolved} numeric className={className}>
      {prefix}
      {body}
    </Text>
  );
};
