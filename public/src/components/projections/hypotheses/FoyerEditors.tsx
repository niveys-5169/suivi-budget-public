import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Stack, Text } from '../../../ui';
import type { ProjectionParams } from '../../../types/banking.types';
import type { SectionProps } from './editorTypes';
import { DateField, NumberField, TextField } from './FormFields';
import { ItemRow } from './ItemRow';
import { newId, removeItem, updateItem } from './listUtils';

/** Supprime une personne et les phases / pensions qui lui sont rattachées. */
function withoutPersonne(draft: ProjectionParams, id: string): ProjectionParams {
  const keep = <T extends { personneId: string }>(list: T[]) =>
    list.filter((x) => x.personneId !== id);
  return {
    ...draft,
    personnes: draft.personnes.filter((p) => p.id !== id),
    revenusCommuns: {
      ...draft.revenusCommuns,
      phases: keep(draft.revenusCommuns.phases),
      pensions: keep(draft.revenusCommuns.pensions),
    },
    scenarios: draft.scenarios.map((s) => ({
      ...s,
      phases: keep(s.phases),
      pensions: keep(s.pensions),
    })),
  };
}

export const PersonnesEditor: React.FC<SectionProps> = ({ draft, onChange }) => {
  const { personnes } = draft;
  return (
    <Stack gap="md">
      <Text variant="headline">Personnes</Text>
      {personnes.map((p) => (
        <ItemRow
          key={p.id}
          removeLabel={`Supprimer ${p.prenom || 'la personne'}`}
          onRemove={() => onChange(withoutPersonne(draft, p.id))}
        >
          <TextField
            label="Prénom"
            value={p.prenom}
            onChange={(prenom) =>
              onChange({ ...draft, personnes: updateItem(personnes, p.id, { prenom }) })
            }
          />
          <DateField
            kind="date"
            label="Date de naissance"
            value={p.dateNaissance}
            onChange={(v) =>
              onChange({
                ...draft,
                personnes: updateItem(personnes, p.id, { dateNaissance: v || undefined }),
              })
            }
          />
          <NumberField
            label="Âge de fin d'activité"
            value={p.ageFinActivite}
            optional
            onChange={(ageFinActivite) =>
              onChange({ ...draft, personnes: updateItem(personnes, p.id, { ageFinActivite }) })
            }
          />
        </ItemRow>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() =>
            onChange({ ...draft, personnes: [...personnes, { id: newId(), prenom: '' }] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter une personne
        </Button>
      </div>
    </Stack>
  );
};

export const EnfantsEditor: React.FC<SectionProps> = ({ draft, onChange }) => {
  const { enfants } = draft;
  return (
    <Stack gap="md">
      <Text variant="headline">Enfants</Text>
      {enfants.length === 0 && (
        <Text variant="footnote" tone="tertiary">
          {"Aucun enfant : la CAF ne s'arrêtera pas à un âge donné."}
        </Text>
      )}
      {enfants.map((e) => (
        <ItemRow
          key={e.id}
          removeLabel={`Supprimer ${e.prenom || "l'enfant"}`}
          onRemove={() => onChange({ ...draft, enfants: removeItem(enfants, e.id) })}
        >
          <TextField
            label="Prénom de l'enfant"
            value={e.prenom}
            onChange={(prenom) =>
              onChange({ ...draft, enfants: updateItem(enfants, e.id, { prenom }) })
            }
          />
          <DateField
            kind="date"
            label="Date de naissance de l'enfant"
            value={e.dateNaissance}
            onChange={(dateNaissance) =>
              onChange({ ...draft, enfants: updateItem(enfants, e.id, { dateNaissance }) })
            }
          />
        </ItemRow>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() =>
            onChange({ ...draft, enfants: [...enfants, { id: newId(), dateNaissance: '' }] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un enfant
        </Button>
      </div>
    </Stack>
  );
};
