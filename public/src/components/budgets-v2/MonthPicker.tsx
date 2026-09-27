import React from 'react';
import { Chip, Text } from '../../ui';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const monthShort = (m: number) =>
  new Date(2026, m - 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

interface Props {
  value: number | null;
  onChange: (month: number) => void;
  label?: string;
  required?: boolean;
}

/** Choix d'un mois (1–12) en grille de pastilles — mois de l'événement d'une enveloppe. */
export const MonthPicker: React.FC<Props> = ({
  value,
  onChange,
  label = "Mois de l'événement",
  required,
}) => (
  <div className="flex flex-col gap-2" role="group" aria-label={label}>
    <Text variant="footnote" tone="secondary">
      {label}
      {required && (
        <span className="text-negative" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </Text>
    <div className="grid grid-cols-4 gap-2">
      {MONTHS.map((m) => (
        <Chip key={m} selected={value === m} onClick={() => onChange(m)} className="justify-center">
          {monthShort(m)}
        </Chip>
      ))}
    </div>
  </div>
);
