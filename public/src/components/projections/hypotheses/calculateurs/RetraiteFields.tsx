import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Separator, Stack, Text } from '../../../../ui';
import type { ProjectionParams, ProjectionRetraiteParams } from '../../../../types/banking.types';
import { createDefaultRetraitePersonne } from '../../../../utils/projection/calculateurs/defaults';
import { NumberField } from '../FormFields';
import { RetraitePersonneFields } from './RetraitePersonneFields';

interface Props {
  value: ProjectionRetraiteParams;
  draft: ProjectionParams;
  onChange: (next: ProjectionRetraiteParams) => void;
}

/** Paramètres de retraite du foyer : un bloc par personne, plus la part déductible de la CSG. */
export const RetraiteFields: React.FC<Props> = ({ value, draft, onChange }) => {
  const sansRetraite = draft.personnes
    .slice(0, 2)
    .filter((p) => !value.personnes.some((r) => r.personneId === p.id));

  return (
    <Stack gap="lg">
      <NumberField
        label="Part déductible de la CSG sur les pensions"
        hint="Vide : taux légal"
        percent
        optional
        value={value.partCsgDeductible}
        onChange={(partCsgDeductible) => onChange({ ...value, partCsgDeductible })}
      />
      {value.personnes.map((retraite) => {
        const nom = draft.personnes.find((p) => p.id === retraite.personneId)?.prenom;
        return (
          <Stack
            key={retraite.personneId}
            gap="lg"
            role="group"
            aria-label={`Retraite — ${nom || 'personne inconnue'}`}
          >
            <Separator />
            <Text variant="title3">{`Retraite — ${nom || 'personne inconnue'}`}</Text>
            <RetraitePersonneFields
              value={retraite}
              onChange={(next) =>
                onChange({
                  ...value,
                  personnes: value.personnes.map((r) => (r === retraite ? next : r)),
                })
              }
            />
          </Stack>
        );
      })}
      {sansRetraite.map((p) => (
        <div key={p.id}>
          <Button
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                personnes: [...value.personnes, createDefaultRetraitePersonne(draft, p.id)],
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            {`Ajouter la retraite de ${p.prenom || 'la personne'}`}
          </Button>
        </div>
      ))}
    </Stack>
  );
};
