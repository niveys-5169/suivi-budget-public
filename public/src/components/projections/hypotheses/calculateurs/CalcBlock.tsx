import React from 'react';
import { Stack, Text } from '../../../../ui';

interface Props {
  title: string;
  hint?: string;
  children: React.ReactNode;
}

/** Groupe de champs d'un calculateur : titre, aide éventuelle et grille de saisie. */
export const CalcBlock: React.FC<Props> = ({ title, hint, children }) => (
  <Stack gap="md">
    <Stack gap="xs">
      <Text variant="headline">{title}</Text>
      {hint && (
        <Text variant="footnote" tone="tertiary">
          {hint}
        </Text>
      )}
    </Stack>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </Stack>
);
