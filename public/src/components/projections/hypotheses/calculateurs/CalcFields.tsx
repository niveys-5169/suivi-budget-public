import React from 'react';
import { Stack, Switch, Text } from '../../../../ui';
import { NumberField } from '../FormFields';
import { withTripletValue } from './calcUtils';

interface SwitchFieldProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/** Interrupteur libellé, avec une aide en dessous. */
export const SwitchField: React.FC<SwitchFieldProps> = ({ label, hint, checked, onChange }) => (
  <Stack direction="row" align="center" gap="md">
    <Switch label={label} checked={checked} onChange={onChange} />
    <Stack gap="xs">
      <Text variant="subhead">{label}</Text>
      {hint && (
        <Text variant="footnote" tone="tertiary">
          {hint}
        </Text>
      )}
    </Stack>
  </Stack>
);

interface TripletFieldProps {
  label: string;
  value: readonly [number, number, number];
  onChange: (next: [number, number, number]) => void;
  percent?: boolean;
  hint?: string;
}

const YEARS = ['année 1', 'année 2', 'année 3 et suivantes'] as const;

/** Trois valeurs pour les années 1, 2 et 3+ de la montée en charge du cabinet libéral. */
export const TripletField: React.FC<TripletFieldProps> = ({
  label,
  value,
  onChange,
  percent,
  hint,
}) => (
  <>
    {YEARS.map((year, i) => (
      <NumberField
        key={year}
        label={`${label}, ${year}`}
        hint={i === 0 ? hint : undefined}
        percent={percent}
        value={value[i]}
        onChange={(v) => onChange(withTripletValue(value, i, v ?? 0))}
      />
    ))}
  </>
);
