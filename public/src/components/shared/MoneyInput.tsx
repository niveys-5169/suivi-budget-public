import React, { useEffect, useRef, useState } from 'react';
import { parseDecimal } from '../../utils/format';

type MoneyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Valeur numérique courante (`null` = champ vide). */
  value: number | null;
  /** Émis à chaque saisie (`null` quand le champ est vide). */
  onChange: (value: number | null) => void;
};

const norm = (v: number | null | undefined): number | null =>
  v === null || v === undefined || Number.isNaN(v) ? null : v;

const toRaw = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',');

/** Garde uniquement les chiffres, un seul séparateur décimal et un `-` en tête. */
const sanitize = (input: string): string => {
  const negative = input.trimStart().startsWith('-');
  let s = input.replace(/[^0-9.,]/g, '');
  const firstSep = s.search(/[.,]/);
  if (firstSep !== -1) {
    const head = s.slice(0, firstSep + 1);
    const tail = s.slice(firstSep + 1).replace(/[.,]/g, '');
    s = head + tail;
  }
  return (negative ? '-' : '') + s;
};

/**
 * Champ de saisie monétaire/décimale.
 *
 * - `type="text"` + `inputMode="decimal"` : accepte la **virgule** comme séparateur
 *   décimal (clavier numérique conservé sur mobile).
 * - Conserve une chaîne interne, ce qui permet de laisser le champ **vide** (aucun `0`
 *   forcé) et de saisir progressivement (`12,` puis `12,5`).
 * - Ne se resynchronise depuis le parent que lorsque la valeur externe diffère de la
 *   dernière valeur émise (ex. `reset` de formulaire, suggestion IA), sans jamais écraser
 *   une saisie en cours.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, ...rest }, ref) => {
    const [raw, setRaw] = useState<string>(() => toRaw(norm(value)));
    const lastEmitted = useRef<number | null>(norm(value));

    useEffect(() => {
      const next = norm(value);
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        setRaw(toRaw(next));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = sanitize(e.target.value);
      setRaw(next);
      const parsed = parseDecimal(next);
      lastEmitted.current = parsed;
      onChange(parsed);
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        {...rest}
      />
    );
  },
);

MoneyInput.displayName = 'MoneyInput';
