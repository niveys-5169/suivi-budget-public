import React from 'react';
import { Button, Stack, Text } from '../../../ui';

interface Props {
  /** Montants annuels importés du classeur (clé = année) ; rien n'est affiché s'il est vide. */
  montantsAnnuels?: Record<string, number>;
  onClear: () => void;
}

/** Mention « Montants annuels importés (N années) » avec bouton Effacer et texte d'aide. */
export const ImportedAmountsNotice: React.FC<Props> = ({ montantsAnnuels, onClear }) => {
  const annees = Object.keys(montantsAnnuels ?? {}).length;
  if (annees === 0) return null;
  return (
    <Stack gap="xs">
      <Stack direction="row" align="center" gap="md" wrap>
        <Text variant="footnote" tone="secondary">
          {`Montants annuels importés (${annees} années)`}
        </Text>
        <Button size="sm" variant="plain" onClick={onClear}>
          Effacer
        </Button>
      </Stack>
      <Text variant="footnote" tone="tertiary">
        Ces montants priment sur le montant saisi ; effacez-les pour utiliser la saisie.
      </Text>
    </Stack>
  );
};
