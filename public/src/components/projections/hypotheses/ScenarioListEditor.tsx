import React, { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button, SegmentedControl, Stack } from '../../../ui';
import { CalculatedIncomeNotice } from './calculateurs/CalculatedIncomeNotice';
import type { ContextSectionProps } from './editorTypes';
import { TextField } from './FormFields';
import { ScenarioPhasesEditor } from './ScenarioPhasesEditor';
import { addScenario, canAddScenario, duplicateScenario, removeScenario } from './scenarioActions';

/** Liste des scénarios (1 à 5) : un sélecteur, les actions et l'éditeur du scénario choisi. */
export const ScenarioListEditor: React.FC<ContextSectionProps> = ({ draft, onChange, ctx }) => {
  const [selectedId, setSelectedId] = useState(draft.scenarios[0]?.id ?? '');
  const scenario = draft.scenarios.find((s) => s.id === selectedId) ?? draft.scenarios[0];
  if (!scenario) return null;

  const patchScenario = (patch: Partial<typeof scenario>) =>
    onChange({
      ...draft,
      scenarios: draft.scenarios.map((s) => (s.id === scenario.id ? { ...s, ...patch } : s)),
    });
  const apply = (result: { next: typeof draft; id: string }) => {
    onChange(result.next);
    setSelectedId(result.id);
  };

  return (
    <Stack gap="md">
      <Stack direction="row" align="center" justify="between" wrap gap="md">
        <SegmentedControl
          label="Scénario à modifier"
          segments={draft.scenarios.map((s) => ({ value: s.id, label: s.nom || 'Sans nom' }))}
          value={scenario.id}
          onChange={setSelectedId}
        />
        <Stack direction="row" gap="sm">
          <Button
            size="sm"
            disabled={!canAddScenario(draft)}
            onClick={() => apply(addScenario(draft))}
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter un scénario
          </Button>
          <Button
            size="sm"
            disabled={!canAddScenario(draft)}
            onClick={() => apply(duplicateScenario(draft, scenario.id))}
          >
            <Copy size={16} aria-hidden="true" />
            Dupliquer
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={draft.scenarios.length <= 1}
            onClick={() => {
              const next = removeScenario(draft, scenario.id);
              onChange(next);
              setSelectedId(next.scenarios[0]?.id ?? '');
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Supprimer
          </Button>
        </Stack>
      </Stack>
      <TextField
        label="Nom du scénario"
        value={scenario.nom}
        onChange={(nom) => patchScenario({ nom })}
      />
      <CalculatedIncomeNotice params={draft} />
      <ScenarioPhasesEditor
        phases={scenario.phases}
        pensions={scenario.pensions}
        personnes={draft.personnes}
        ctx={ctx}
        defaultMonth={draft.horizon.debut}
        onChange={patchScenario}
      />
    </Stack>
  );
};
