import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Stack, Text } from '../../../ui';
import type {
  ProjectionPension,
  ProjectionPersonne,
  ProjectionPhaseRevenu,
} from '../../../types/banking.types';
import type { EditorContext } from './editorTypes';
import { newId, removeItem, updateItem } from './listUtils';
import { PensionRow } from './PensionRow';
import { PhaseRow } from './PhaseRow';

interface Props {
  phases: ProjectionPhaseRevenu[];
  pensions: ProjectionPension[];
  personnes: ProjectionPersonne[];
  ctx: EditorContext;
  /** Mois proposé pour une nouvelle phase ou pension. */
  defaultMonth: string;
  onChange: (next: { phases: ProjectionPhaseRevenu[]; pensions: ProjectionPension[] }) => void;
}

/** Éditeur des phases de revenu et des pensions (scénario ou revenus communs). */
export const ScenarioPhasesEditor: React.FC<Props> = ({
  phases,
  pensions,
  personnes,
  ctx,
  defaultMonth,
  onChange,
}) => {
  const personneId = personnes[0]?.id ?? '';
  return (
    <Stack gap="lg">
      <Stack gap="md">
        <Text variant="headline">Phases de revenu</Text>
        {phases.length === 0 && (
          <Text variant="footnote" tone="tertiary">
            {"Aucune phase : ajoutez-en une pour projeter des revenus d'activité."}
          </Text>
        )}
        {phases.map((phase) => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            personnes={personnes}
            ctx={ctx}
            onChange={(patch) =>
              onChange({ phases: updateItem(phases, phase.id, patch), pensions })
            }
            onRemove={() => onChange({ phases: removeItem(phases, phase.id), pensions })}
          />
        ))}
        <div>
          <Button
            size="sm"
            disabled={personnes.length === 0}
            onClick={() =>
              onChange({
                pensions,
                phases: [
                  ...phases,
                  {
                    id: newId(),
                    personneId,
                    libelle: '',
                    debut: defaultMonth,
                    netMensuel: { mode: 'manuel', manuel: 0 },
                    revalorisationAnnuelle: 0,
                  },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter une phase
          </Button>
        </div>
      </Stack>

      <Stack gap="md">
        <Text variant="headline">Pensions de retraite</Text>
        {pensions.length === 0 && (
          <Text variant="footnote" tone="tertiary">
            {"Aucune pension. Montants en euros de l'année de référence, indexés sur l'inflation."}
          </Text>
        )}
        {pensions.map((pension) => (
          <PensionRow
            key={pension.id}
            pension={pension}
            personnes={personnes}
            onChange={(patch) =>
              onChange({ phases, pensions: updateItem(pensions, pension.id, patch) })
            }
            onRemove={() => onChange({ phases, pensions: removeItem(pensions, pension.id) })}
          />
        ))}
        <div>
          <Button
            size="sm"
            disabled={personnes.length === 0}
            onClick={() =>
              onChange({
                phases,
                pensions: [
                  ...pensions,
                  {
                    id: newId(),
                    personneId,
                    debut: defaultMonth,
                    netAvantImpot: 0,
                    netApresImpot: 0,
                  },
                ],
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter une pension
          </Button>
        </div>
      </Stack>
    </Stack>
  );
};
