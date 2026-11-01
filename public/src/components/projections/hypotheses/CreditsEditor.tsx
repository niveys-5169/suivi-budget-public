import React from 'react';
import { Plus } from 'lucide-react';
import { Button, Separator, Stack, Text } from '../../../ui';
import type { ContextSectionProps } from './editorTypes';
import { CreditRow } from './CreditRow';
import { newId, removeItem, updateItem } from './listUtils';

export const CreditsEditor: React.FC<ContextSectionProps> = ({ draft, onChange, ctx }) => {
  const { credits } = draft.depenses;
  const setCredits = (next: typeof credits) =>
    onChange({ ...draft, depenses: { ...draft.depenses, credits: next } });

  return (
    <Stack gap="md">
      <Text variant="headline">Crédits</Text>
      {credits.length === 0 && (
        <Text variant="footnote" tone="tertiary">
          Aucun crédit : le budget de référence est considéré sans mensualité fixe.
        </Text>
      )}
      {credits.map((credit) => (
        <React.Fragment key={credit.id}>
          <CreditRow
            credit={credit}
            appCredits={ctx.credits}
            ctx={ctx}
            defaultMonth={draft.horizon.debut}
            onChange={(next) => setCredits(updateItem(credits, credit.id, next))}
            onRemove={() => setCredits(removeItem(credits, credit.id))}
          />
          <Separator />
        </React.Fragment>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() =>
            setCredits([
              ...credits,
              { id: newId(), libelle: 'Nouveau crédit', mode: 'manuel', mensualiteManuelle: 0 },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un crédit
        </Button>
      </div>
    </Stack>
  );
};
