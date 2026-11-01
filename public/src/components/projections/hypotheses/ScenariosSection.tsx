import React from 'react';
import { Separator, Stack, Text } from '../../../ui';
import { CafEditor } from './CafEditor';
import { CalculatedIncomeNotice } from './calculateurs/CalculatedIncomeNotice';
import type { ContextSectionProps } from './editorTypes';
import { ScenarioListEditor } from './ScenarioListEditor';
import { ScenarioPhasesEditor } from './ScenarioPhasesEditor';

export const ScenariosSection: React.FC<ContextSectionProps> = (props) => {
  const { draft, onChange, ctx } = props;
  const { revenusCommuns } = draft;
  return (
    <>
      <ScenarioListEditor {...props} />
      <Separator />
      <Stack gap="md">
        <Text variant="title3">Revenus communs à tous les scénarios</Text>
        <CalculatedIncomeNotice params={draft} />
        <ScenarioPhasesEditor
          phases={revenusCommuns.phases}
          pensions={revenusCommuns.pensions}
          personnes={draft.personnes}
          ctx={ctx}
          defaultMonth={draft.horizon.debut}
          onChange={(next) =>
            onChange({ ...draft, revenusCommuns: { ...revenusCommuns, ...next } })
          }
        />
      </Stack>
      <Separator />
      <CafEditor {...props} />
    </>
  );
};
