import React from 'react';
import { Separator, Stack } from '../../../ui';
import type { ProjectionPersonne, ProjectionPhaseRevenu } from '../../../types/banking.types';
import { AutoValueField } from './AutoValueField';
import { sourceAverage } from './CategorySourcePicker';
import type { EditorContext } from './editorTypes';
import { DateField, NumberField, TextField } from './FormFields';
import { ImportedAmountsNotice } from './ImportedAmountsNotice';
import { ItemRow } from './ItemRow';
import { PersonneSelect } from './PersonneSelect';

interface Props {
  phase: ProjectionPhaseRevenu;
  personnes: ProjectionPersonne[];
  ctx: EditorContext;
  onChange: (patch: Partial<ProjectionPhaseRevenu>) => void;
  onRemove: () => void;
}

/** Phase de revenu : période, net mensuel (auto depuis des catégories ou manuel), revalorisation. */
export const PhaseRow: React.FC<Props> = ({ phase, personnes, ctx, onChange, onRemove }) => {
  return (
    <Stack gap="md">
      <ItemRow
        removeLabel={`Supprimer la phase ${phase.libelle || 'sans nom'}`}
        onRemove={onRemove}
      >
        <PersonneSelect
          personnes={personnes}
          value={phase.personneId}
          onChange={(personneId) => onChange({ personneId })}
        />
        <TextField
          label="Libellé de la phase"
          value={phase.libelle}
          onChange={(libelle) => onChange({ libelle })}
        />
        <DateField
          kind="month"
          label="Début de la phase"
          value={phase.debut}
          onChange={(debut) => onChange({ debut })}
        />
        <DateField
          kind="month"
          label="Fin de la phase"
          hint="Vide : jusqu'à la fin de l'horizon"
          value={phase.fin}
          onChange={(fin) => onChange({ fin: fin || undefined })}
        />
      </ItemRow>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AutoValueField
            label={`Net mensuel — ${phase.libelle || 'phase'}`}
            value={phase.netMensuel}
            observed={sourceAverage(phase.categoriesSource, ctx.observed)}
            onChange={(netMensuel) => onChange({ netMensuel })}
            sources={{
              options: ctx.categories,
              selected: phase.categoriesSource,
              onChange: (categoriesSource) => onChange({ categoriesSource }),
            }}
          />
        </div>
        <NumberField
          label="Revalorisation annuelle"
          percent
          value={phase.revalorisationAnnuelle}
          onChange={(v) => onChange({ revalorisationAnnuelle: v ?? 0 })}
        />
      </div>
      <ImportedAmountsNotice
        montantsAnnuels={phase.montantsAnnuels}
        onClear={() => onChange({ montantsAnnuels: undefined })}
      />
      <Separator />
    </Stack>
  );
};
