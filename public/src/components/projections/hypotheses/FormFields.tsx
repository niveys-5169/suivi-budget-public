import React, { useEffect, useRef, useState } from 'react';
import { Field, Input } from '../../../ui';
import { parseDecimal } from '../../../utils/format';

interface BaseProps {
  label: string;
  hint?: string;
  className?: string;
}

interface TextFieldProps extends BaseProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  hint,
  className,
}) => (
  <Field label={label} hint={hint} className={className}>
    {(p) => <Input {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
  </Field>
);

interface DateFieldProps extends BaseProps {
  /** `month` : valeur 'YYYY-MM' ; `date` : 'YYYY-MM-DD'. */
  kind: 'month' | 'date';
  value: string | undefined;
  /** Champ vidé : '' est transmis. */
  onChange: (value: string) => void;
}

export const DateField: React.FC<DateFieldProps> = ({ kind, label, value, onChange, ...rest }) => (
  <Field label={label} {...rest}>
    {(p) => (
      <Input {...p} type={kind} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    )}
  </Field>
);

const round = (n: number) => Math.round(n * 1e8) / 1e8;
const toRaw = (v: number | undefined, scale: number) =>
  v === undefined ? '' : String(round(v * scale)).replace('.', ',');

interface NumberFieldProps extends BaseProps {
  value: number | undefined;
  /** Champ vidé : `undefined` si `optional`, sinon 0. */
  onChange: (value: number | undefined) => void;
  optional?: boolean;
  /** Saisie en % (2 pour 2 %), valeur stockée en décimal (0,02). */
  percent?: boolean;
}

/** Champ numérique : virgule acceptée, saisie en cours jamais écrasée par le parent. */
export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  optional = false,
  percent = false,
  hint,
  className,
}) => {
  const scale = percent ? 100 : 1;
  const [raw, setRaw] = useState(() => toRaw(value, scale));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setRaw(toRaw(value, scale));
    }
  }, [value, scale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setRaw(text);
    const parsed = parseDecimal(text);
    const next = parsed === null ? (optional ? undefined : 0) : round(parsed / scale);
    lastEmitted.current = next;
    onChange(next);
  };

  return (
    <Field label={percent ? `${label} (%)` : label} hint={hint} className={className}>
      {(p) => <Input {...p} type="text" inputMode="decimal" value={raw} onChange={handleChange} />}
    </Field>
  );
};
