import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, IconButton, Stack, Text } from '../../../../ui';
import { NumberField } from '../FormFields';

interface Props {
  value: Record<string, number> | undefined;
  anneeReleve: number;
  onChange: (next: Record<string, number>) => void;
}

/** Salaires bruts annuels du relevé de carrière : une ligne par année, qui prime sur la carrière projetée. */
export const SalairesPassesEditor: React.FC<Props> = ({ value = {}, anneeReleve, onChange }) => {
  const annees = Object.keys(value).sort();
  const prochaine = annees.length > 0 ? Number(annees[annees.length - 1]) + 1 : anneeReleve;

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text variant="headline">Salaires bruts du relevé</Text>
        <Text variant="footnote" tone="tertiary">
          Salaire brut annuel connu par année civile : il remplace la carrière projetée.
        </Text>
      </Stack>
      {annees.map((annee) => (
        <Stack key={annee} direction="row" align="start" gap="md">
          <NumberField
            className="flex-1"
            label={`Salaire brut ${annee} (€)`}
            value={value[annee]}
            onChange={(v) => onChange({ ...value, [annee]: v ?? 0 })}
          />
          <IconButton
            label={`Supprimer le salaire ${annee}`}
            variant="plain"
            onClick={() =>
              onChange(
                Object.fromEntries(annees.filter((a) => a !== annee).map((a) => [a, value[a]!])),
              )
            }
          >
            <Trash2 size={20} aria-hidden="true" />
          </IconButton>
        </Stack>
      ))}
      <div>
        <Button size="sm" onClick={() => onChange({ ...value, [String(prochaine)]: 0 })}>
          <Plus size={16} aria-hidden="true" />
          {`Ajouter l'année ${prochaine}`}
        </Button>
      </div>
    </Stack>
  );
};
