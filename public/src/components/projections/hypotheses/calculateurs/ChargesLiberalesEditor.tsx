import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, IconButton, Select, Stack, Text } from '../../../../ui';
import type {
  ProjectionChargeLiberale,
  ProjectionChargeLiberaleNature,
} from '../../../../types/banking.types';
import { NumberField, TextField } from '../FormFields';

const NATURES: readonly { value: ProjectionChargeLiberaleNature; label: string }[] = [
  { value: 'fixe', label: 'Fixe' },
  { value: 'variable', label: 'Variable (proportionnelle aux mesures)' },
  { value: 'cfe', label: 'CFE (coefficient de montée en charge)' },
];

interface Props {
  value: ProjectionChargeLiberale[];
  onChange: (next: ProjectionChargeLiberale[]) => void;
}

/** Postes de charges du cabinet libéral, au budget de référence (€ par an). */
export const ChargesLiberalesEditor: React.FC<Props> = ({ value, onChange }) => {
  const patch = (index: number, change: Partial<ProjectionChargeLiberale>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...change } : c)));

  return (
    <Stack gap="md">
      <Text variant="headline">Charges du cabinet</Text>
      {value.length === 0 && (
        <Text variant="footnote" tone="tertiary">
          Aucune charge : ajoutez les postes du budget de référence du cabinet.
        </Text>
      )}
      {value.map((charge, i) => (
        // L'ordre des postes est l'identité de la ligne : pas d'identifiant propre.
        <Stack key={i} direction="row" align="start" gap="md">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              label="Libellé de la charge"
              value={charge.libelle}
              onChange={(libelle) => patch(i, { libelle })}
            />
            <NumberField
              label="Montant de référence (€ par an)"
              value={charge.montantReference}
              onChange={(v) => patch(i, { montantReference: v ?? 0 })}
            />
            <Field label="Nature de la charge">
              {(p) => (
                <Select
                  {...p}
                  value={charge.nature}
                  onChange={(e) =>
                    patch(i, { nature: e.target.value as ProjectionChargeLiberaleNature })
                  }
                >
                  {NATURES.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <IconButton
            label={`Supprimer la charge ${charge.libelle || 'sans nom'}`}
            variant="plain"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 size={20} aria-hidden="true" />
          </IconButton>
        </Stack>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() => onChange([...value, { libelle: '', montantReference: 0, nature: 'fixe' }])}
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter une charge
        </Button>
      </div>
    </Stack>
  );
};
