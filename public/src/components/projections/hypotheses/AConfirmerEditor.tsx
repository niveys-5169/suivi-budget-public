import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Stack, Text } from '../../../ui';
import type { SectionProps } from './editorTypes';
import { TextField } from './FormFields';
import { ItemRow } from './ItemRow';
import { newId, removeItem, updateItem } from './listUtils';

/** Hypothèses incertaines à vérifier (les ⚠️ de l'onglet Hypothèses de l'Excel). */
export const AConfirmerEditor: React.FC<SectionProps> = ({ draft, onChange }) => {
  const { aConfirmer } = draft;
  return (
    <Stack gap="md">
      {aConfirmer.length === 0 && (
        <Text variant="footnote" tone="tertiary">
          Aucun point à confirmer.
        </Text>
      )}
      {aConfirmer.map((point) => (
        <ItemRow
          key={point.id}
          removeLabel={`Supprimer le point ${point.libelle || 'sans libellé'}`}
          onRemove={() => onChange({ ...draft, aConfirmer: removeItem(aConfirmer, point.id) })}
        >
          <TextField
            label="Point à confirmer"
            value={point.libelle}
            onChange={(libelle) =>
              onChange({ ...draft, aConfirmer: updateItem(aConfirmer, point.id, { libelle }) })
            }
          />
          <TextField
            label="Commentaire"
            value={point.commentaire}
            onChange={(commentaire) =>
              onChange({
                ...draft,
                aConfirmer: updateItem(aConfirmer, point.id, {
                  commentaire: commentaire || undefined,
                }),
              })
            }
          />
        </ItemRow>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() =>
            onChange({ ...draft, aConfirmer: [...aConfirmer, { id: newId(), libelle: '' }] })
          }
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un point
        </Button>
      </div>
    </Stack>
  );
};
