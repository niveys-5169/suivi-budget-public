import React from 'react';
import type { ProjectionPension, ProjectionPersonne } from '../../../types/banking.types';
import { Stack } from '../../../ui';
import { DateField, NumberField } from './FormFields';
import { ImportedAmountsNotice } from './ImportedAmountsNotice';
import { ItemRow } from './ItemRow';
import { PersonneSelect } from './PersonneSelect';

interface Props {
  pension: ProjectionPension;
  personnes: ProjectionPersonne[];
  onChange: (patch: Partial<ProjectionPension>) => void;
  onRemove: () => void;
}

export const PensionRow: React.FC<Props> = ({ pension, personnes, onChange, onRemove }) => (
  <Stack gap="md">
    <ItemRow removeLabel="Supprimer la pension" onRemove={onRemove}>
      <PersonneSelect
        personnes={personnes}
        value={pension.personneId}
        onChange={(personneId) => onChange({ personneId })}
      />
      <DateField
        kind="month"
        label="Début de la pension"
        value={pension.debut}
        onChange={(debut) => onChange({ debut })}
      />
      <NumberField
        label="Pension nette avant impôt (€/mois)"
        value={pension.netAvantImpot}
        onChange={(v) => onChange({ netAvantImpot: v ?? 0 })}
      />
      <NumberField
        label="Pension nette après impôt (€/mois)"
        value={pension.netApresImpot}
        onChange={(v) => onChange({ netApresImpot: v ?? 0 })}
      />
    </ItemRow>
    <ImportedAmountsNotice
      montantsAnnuels={pension.montantsAnnuels}
      onClear={() => onChange({ montantsAnnuels: undefined })}
    />
  </Stack>
);
