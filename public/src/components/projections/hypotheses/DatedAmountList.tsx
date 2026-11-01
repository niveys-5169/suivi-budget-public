import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Stack, Text } from '../../../ui';
import type { ProjectionMontantDate } from '../../../types/banking.types';
import { DateField, NumberField, TextField } from './FormFields';
import { ItemRow } from './ItemRow';
import { newId, removeItem, updateItem } from './listUtils';

interface Props {
  title: string;
  items: ProjectionMontantDate[];
  onChange: (next: ProjectionMontantDate[]) => void;
  /** Mois proposé pour un nouvel élément. */
  defaultMonth: string;
  addLabel: string;
  emptyHint: string;
}

/** Liste de montants datés (dépenses exceptionnelles, encaissements ponctuels). */
export const DatedAmountList: React.FC<Props> = ({
  title,
  items,
  onChange,
  defaultMonth,
  addLabel,
  emptyHint,
}) => (
  <Stack gap="md">
    <Text variant="headline">{title}</Text>
    {items.length === 0 && (
      <Text variant="footnote" tone="tertiary">
        {emptyHint}
      </Text>
    )}
    {items.map((item) => (
      <ItemRow
        key={item.id}
        removeLabel={`Supprimer ${item.libelle || 'la ligne'}`}
        onRemove={() => onChange(removeItem(items, item.id))}
      >
        <TextField
          label="Libellé"
          value={item.libelle}
          onChange={(libelle) => onChange(updateItem(items, item.id, { libelle }))}
        />
        <NumberField
          label="Montant (€)"
          value={item.montant}
          onChange={(montant) => onChange(updateItem(items, item.id, { montant: montant ?? 0 }))}
        />
        <DateField
          kind="month"
          label="Mois"
          value={item.mois}
          onChange={(mois) => onChange(updateItem(items, item.id, { mois }))}
        />
      </ItemRow>
    ))}
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange([...items, { id: newId(), libelle: '', montant: 0, mois: defaultMonth }])
        }
      >
        <Plus size={16} aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  </Stack>
);
