import React from 'react';
import { Field, Select } from '../../../ui';

interface Props {
  label: string;
  names: string[];
  /** Mois calendaire de 1 à 12. */
  value: number;
  onChange: (month: number) => void;
}

export const MonthSelect: React.FC<Props> = ({ label, names, value, onChange }) => (
  <Field label={label}>
    {(p) => (
      <Select {...p} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {names.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
    )}
  </Field>
);
