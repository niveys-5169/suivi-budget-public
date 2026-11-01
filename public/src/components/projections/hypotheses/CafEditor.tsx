import React from 'react';
import { Stack, Text } from '../../../ui';
import { AutoValueField } from './AutoValueField';
import { sourceAverage } from './CategorySourcePicker';
import type { ContextSectionProps } from './editorTypes';
import { NumberField } from './FormFields';

/** Allocations familiales : montant (auto ou manuel), évolution annuelle, arrêt selon l'âge de l'aîné. */
export const CafEditor: React.FC<ContextSectionProps> = ({ draft, onChange, ctx }) => {
  const { caf } = draft.revenusCommuns;
  const setCaf = (patch: Partial<typeof caf>) =>
    onChange({ ...draft, revenusCommuns: { ...draft.revenusCommuns, caf: { ...caf, ...patch } } });

  return (
    <Stack gap="md">
      <Text variant="headline">Allocations familiales (CAF)</Text>
      <AutoValueField
        label="Montant mensuel de la CAF"
        value={caf.montant}
        observed={sourceAverage(caf.categoriesSource, ctx.observed)}
        onChange={(montant) => setCaf({ montant })}
        sources={{
          options: ctx.categories,
          selected: caf.categoriesSource,
          onChange: (categoriesSource) => setCaf({ categoriesSource }),
        }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Évolution annuelle de la CAF"
          percent
          value={caf.evolutionAnnuelle}
          onChange={(v) => setCaf({ evolutionAnnuelle: v ?? 0 })}
        />
        <NumberField
          label="Arrêt aux N ans de l'aîné"
          hint="Vide : la CAF dure jusqu'à la fin de l'horizon"
          optional
          value={caf.arretAuxAnsAine}
          onChange={(arretAuxAnsAine) => setCaf({ arretAuxAnsAine })}
        />
      </div>
    </Stack>
  );
};
