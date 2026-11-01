import React from 'react';
import { Chip, Stack, Text } from '../../../ui';
import type { ProjectionValeursObservees } from '../../../types/banking.types';

/** Moyenne mensuelle cumulée des catégories sources (null si aucune n'est observée). */
export function sourceAverage(
  selected: string[] | undefined,
  observed: ProjectionValeursObservees,
): number | null {
  const found = (selected ?? []).filter((c) => c in observed.moyenneMensuelleParCategorie);
  if (found.length === 0) return null;
  return found.reduce((sum, c) => sum + (observed.moyenneMensuelleParCategorie[c] ?? 0), 0);
}

interface Props {
  options: string[];
  selected: string[] | undefined;
  onChange: (next: string[]) => void;
}

/** Sélection des catégories dont la moyenne sur 12 mois alimente une valeur automatique. */
export const CategorySourcePicker: React.FC<Props> = ({ options, selected = [], onChange }) => {
  const toggle = (category: string) =>
    onChange(
      selected.includes(category)
        ? selected.filter((c) => c !== category)
        : [...selected, category],
    );

  return (
    <Stack gap="sm">
      <Text variant="caption" tone="secondary">
        Catégories sources
      </Text>
      {options.length === 0 ? (
        <Text variant="footnote" tone="tertiary">
          Aucune catégorie observée sur les 12 derniers mois.
        </Text>
      ) : (
        <Stack direction="row" wrap gap="sm" className="max-h-40 overflow-y-auto">
          {options.map((category) => (
            <Chip
              key={category}
              selected={selected.includes(category)}
              onClick={() => toggle(category)}
            >
              {category}
            </Chip>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
