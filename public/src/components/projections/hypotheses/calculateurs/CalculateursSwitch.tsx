import React from 'react';
import { Stack, Text } from '../../../../ui';
import { SwitchField } from './CalcFields';

interface Props {
  actif: boolean;
  messages: readonly string[];
  onChange: (next: boolean) => void;
}

/** Interrupteur « Calculer les revenus et les retraites », son aide et les alertes de résolution. */
export const CalculateursSwitch: React.FC<Props> = ({ actif, messages, onChange }) => (
  <Stack gap="md">
    <SwitchField
      label="Calculer les revenus et les retraites"
      hint="Actif : les revenus de chaque personne et de chaque scénario sont calculés (activité, impôt, retraite) et remplacent les phases et montants saisis ou importés de ces personnes."
      checked={actif}
      onChange={onChange}
    />
    {actif && messages.length > 0 && (
      <Stack gap="xs" role="alert">
        {messages.map((message) => (
          <Text key={message} variant="footnote" tone="warning">
            {message}
          </Text>
        ))}
      </Stack>
    )}
  </Stack>
);
