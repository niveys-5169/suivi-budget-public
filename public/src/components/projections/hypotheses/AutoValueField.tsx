import React from 'react';
import { Badge, SegmentedControl, Stack, Text } from '../../../ui';
import type { Segment } from '../../../ui';
import { formatCurrency } from '../../../lib/formatters';
import { describeAutoValue } from '../../../utils/projection/resolveParams';
import type { ProjectionAutoValue } from '../../../types/banking.types';
import { NumberField } from './FormFields';
import { CategorySourcePicker } from './CategorySourcePicker';

const MODES: readonly Segment<ProjectionAutoValue['mode']>[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'manuel', label: 'Manuel' },
];

const euros = (n: number) => formatCurrency(n, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

interface Props {
  label: string;
  value: ProjectionAutoValue;
  /** Valeur calculée depuis les données de l'app (null = indisponible). */
  observed: number | null;
  onChange: (next: ProjectionAutoValue) => void;
  /** Affiche le badge « à confirmer ». */
  toConfirm?: boolean;
  /** Catégories sources sélectionnables (mode Auto uniquement). */
  sources?: {
    options: string[];
    selected: string[] | undefined;
    onChange: (next: string[]) => void;
  };
}

/** Valeur qui peut être calculée (Auto) ou forcée (Manuel). */
export const AutoValueField: React.FC<Props> = ({
  label,
  value,
  observed,
  onChange,
  toConfirm = false,
  sources,
}) => {
  const { source } = describeAutoValue(value, observed);
  const showManual = value.mode === 'manuel' || source === 'auto-indisponible';

  return (
    <Stack gap="sm">
      <Stack direction="row" align="center" justify="between" wrap gap="sm">
        <Stack direction="row" align="center" gap="sm">
          <Text variant="subhead">{label}</Text>
          {toConfirm && <Badge tone="warning">à confirmer</Badge>}
        </Stack>
        <SegmentedControl
          label={`Mode de ${label}`}
          segments={MODES}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
        />
      </Stack>
      {observed !== null ? (
        <Text variant="footnote" tone="tertiary">
          {`Observé : ${euros(observed)}`}
        </Text>
      ) : source === 'auto-indisponible' ? (
        <Text variant="footnote" tone="warning">
          Non disponible — valeur manuelle utilisée
        </Text>
      ) : (
        <Text variant="footnote" tone="tertiary">
          Observé : non disponible
        </Text>
      )}
      {showManual && (
        <NumberField
          label={`Valeur manuelle — ${label} (€)`}
          value={value.manuel}
          optional
          onChange={(manuel) => onChange({ ...value, manuel })}
        />
      )}
      {value.mode === 'auto' && sources && <CategorySourcePicker {...sources} />}
    </Stack>
  );
};
