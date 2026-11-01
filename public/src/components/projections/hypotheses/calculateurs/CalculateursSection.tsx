import React from 'react';
import { Separator, Stack, Text } from '../../../../ui';
import type { ProjectionParams } from '../../../../types/banking.types';
import { createDefaultCalculateurs } from '../../../../utils/projection/calculateurs/defaults';
import type { SectionProps } from '../editorTypes';
import { ActiviteFields } from './ActiviteFields';
import { CalculateursEmptyState } from './CalculateursEmptyState';
import { CalculateursSwitch } from './CalculateursSwitch';
import { FiscalFields } from './FiscalFields';
import { RetraiteFields } from './RetraiteFields';

type Calculateurs = NonNullable<ProjectionParams['calculateurs']>;

interface Props extends SectionProps {
  /** Messages de résolution des calculateurs (bloc manquant, scénario non calculable…). */
  messages: readonly string[];
}

/** Section « Calculateurs » : revenus et retraites calculés (impôt, retraite, activité). */
export const CalculateursSection: React.FC<Props> = ({ draft, onChange, messages }) => {
  const calc = draft.calculateurs;
  const setCalc = (patch: Partial<Calculateurs>) =>
    onChange({ ...draft, calculateurs: { ...calc, ...patch } });

  if (!calc)
    return (
      <CalculateursEmptyState
        onInit={() => onChange({ ...draft, calculateurs: createDefaultCalculateurs(draft) })}
      />
    );

  return (
    <>
      <CalculateursSwitch
        actif={calc.actif ?? false}
        messages={messages}
        onChange={(actif) => setCalc({ actif })}
      />
      {calc.fiscal && (
        <Stack gap="lg">
          <Separator />
          <Text variant="title3">Impôt</Text>
          <FiscalFields
            value={calc.fiscal}
            personnes={draft.personnes}
            onChange={(fiscal) => setCalc({ fiscal })}
          />
        </Stack>
      )}
      {calc.retraite && (
        <Stack gap="lg">
          <Separator />
          <Text variant="title3">Retraite</Text>
          <RetraiteFields
            value={calc.retraite}
            draft={draft}
            onChange={(retraite) => setCalc({ retraite })}
          />
        </Stack>
      )}
      {calc.activite && (
        <Stack gap="lg">
          <Separator />
          <Text variant="title3">Activité</Text>
          <ActiviteFields
            value={calc.activite}
            draft={draft}
            onChange={(activite) => setCalc({ activite })}
          />
        </Stack>
      )}
    </>
  );
};
